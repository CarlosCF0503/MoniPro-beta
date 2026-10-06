const agendamentoRepository = require('../repositories/agendamentoRepository');
const { validarAntecedenciaCancelamento } = require('../utils/validarAntecedencia');
const {
    ErroValidacao,
    ErroRegraNegocio,
    ErroNaoAutorizado,
    ErroNaoEncontrado,
    ErroConflito
} = require('../utils/erros');

class AgendamentoService {
    async criar(dados) {
        // Duplicidade e capacidade são verificadas na mesma transação, com a linha da monitoria
        // travada, para que inscrições simultâneas não ultrapassem o limite de vagas.
        return await agendamentoRepository.emTransacao(async (tx) => {
            const monitoria = await agendamentoRepository.bloquearMonitoria(dados.id_monitoria, tx);
            if (!monitoria) {
                // A monitoria vem do corpo da requisição, não da URL: é dado inválido (400), não 404
                throw new ErroValidacao('A monitoria selecionada não foi encontrada.', {
                    id_monitoria: 'A monitoria selecionada não foi encontrada.'
                });
            }

            // Impede agendamento duplicado para a mesma monitoria
            const jaExiste = await agendamentoRepository.buscarPorAlunoEMonitoria(
                dados.id_aluno,
                dados.id_monitoria,
                tx
            );
            if (jaExiste) {
                throw new ErroRegraNegocio('Você já está inscrito nesta monitoria.');
            }

            const ocupadas = await agendamentoRepository.contarOcupadas(dados.id_monitoria, tx);
            if (ocupadas >= monitoria.capacidade) {
                // Vaga lotada: conflito de estado, não erro de validação da requisição
                throw new ErroConflito('Esta vaga de monitoria está lotada.');
            }

            return await agendamentoRepository.criar(dados, tx);
        });
    }

    async listarPorAluno(idAluno, paginacao) {
        return await agendamentoRepository.buscarPorAluno(idAluno, paginacao);
    }

    async deletar(id, idAluno) {
        const agendamento = await agendamentoRepository.buscarPorId(id);
        if (!agendamento) {
            throw new ErroNaoEncontrado('Agendamento não encontrado.');
        }
        if (agendamento.id_aluno !== idAluno) {
            throw new ErroNaoAutorizado('Você não tem permissão para cancelar este agendamento.');
        }
        validarAntecedenciaCancelamento(agendamento.data_hora);
        return await agendamentoRepository.deletar(id);
    }

    async concluir(id, idAluno) {
        const agendamento = await agendamentoRepository.buscarPorId(id);
        if (!agendamento) {
            throw new ErroNaoEncontrado('Agendamento não encontrado.');
        }
        if (agendamento.status === 'concluido') {
            throw new ErroRegraNegocio('Este agendamento já foi concluído.');
        }

        const [agendamentoAtualizado] = await agendamentoRepository.concluirEIncrementarPontos(
            id,
            idAluno
        );
        return agendamentoAtualizado;
    }
}

module.exports = new AgendamentoService();
