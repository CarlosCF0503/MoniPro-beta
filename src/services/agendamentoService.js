const agendamentoRepository = require('../repositories/agendamentoRepository');
const { validarAntecedenciaCancelamento } = require('../utils/validarAntecedencia');
const { validarJanelaConfirmacao } = require('../utils/regrasConclusao');
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

            // Só vagas ativas aceitam inscrição (é o mesmo filtro da listagem de vagas)
            if (monitoria.status !== 'ativa') {
                throw new ErroRegraNegocio(
                    'Esta vaga de monitoria não está aberta para inscrições.'
                );
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

            // Tarefa 31: a data/hora do agendamento é sempre a da vaga gravada no banco,
            // nunca a enviada pelo cliente
            return await agendamentoRepository.criar(
                { ...dados, data_hora: monitoria.horario },
                tx
            );
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

    // P2 (R4): só o monitor dono da vaga confirma a presença, depois do horário da sessão e
    // dentro do prazo (D1). Os pontos são creditados ao monitor e ao aluno uma única vez.
    async concluir(id, idMonitor) {
        const agendamento = await agendamentoRepository.buscarPorIdComMonitoria(id);
        if (!agendamento) {
            throw new ErroNaoEncontrado('Agendamento não encontrado.');
        }
        if (agendamento.monitoria.id_monitor !== idMonitor) {
            throw new ErroNaoAutorizado(
                'Só o monitor responsável pela vaga pode confirmar a presença.'
            );
        }
        if (agendamento.status === 'concluido') {
            throw new ErroRegraNegocio('A presença deste aluno já foi confirmada.');
        }
        if (agendamento.status === 'cancelado') {
            throw new ErroRegraNegocio('Não é possível confirmar um agendamento cancelado.');
        }
        validarJanelaConfirmacao(agendamento.monitoria.horario);

        const agendamentoAtualizado = await agendamentoRepository.concluirEPontuar(
            id,
            idMonitor,
            agendamento.id_aluno
        );
        // Outra requisição confirmou o mesmo agendamento entre a leitura e a escrita
        if (!agendamentoAtualizado) {
            throw new ErroRegraNegocio('A presença deste aluno já foi confirmada.');
        }
        return agendamentoAtualizado;
    }
}

module.exports = new AgendamentoService();
