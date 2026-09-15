const prisma = require('../config/bancoDeDados');
const agendamentoRepository = require('../repositories/agendamentoRepository');
const monitoriaRepository = require('../repositories/monitoriaRepository');
const { validarAntecedenciaCancelamento } = require('../utils/validarAntecedencia');

class AgendamentoService {
    async criar(dados) {
        // Tarefa 23: toda a checagem (inscrição duplicada + limite de capacidade) e a
        // criação do agendamento acontecem dentro da mesma transação, para que a contagem
        // de agendamentos existentes usada na validação não fique desatualizada em relação
        // à criação — evitando que duas requisições concorrentes lotem a vaga além do limite.
        return await prisma.$transaction(async (tx) => {
            const monitoria = await monitoriaRepository.buscarPorId(dados.id_monitoria, tx);
            if (!monitoria) {
                throw new Error('A monitoria selecionada não foi encontrada.');
            }

            // Impede agendamento duplicado para a mesma monitoria
            const jaExiste = await agendamentoRepository.buscarPorAlunoEMonitoria(
                dados.id_aluno,
                dados.id_monitoria,
                tx
            );
            if (jaExiste) {
                throw new Error('Você já está inscrito nesta monitoria.');
            }

            const capacidade = typeof monitoria.capacidade === 'number' ? monitoria.capacidade : 1;
            const totalInscritos = await agendamentoRepository.contarPorMonitoria(
                dados.id_monitoria,
                tx
            );
            if (totalInscritos >= capacidade) {
                throw new Error('Vaga lotada: esta monitoria já atingiu o limite de capacidade.');
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
            throw new Error('Agendamento não encontrado.');
        }
        if (agendamento.id_aluno !== idAluno) {
            throw new Error('Não autorizado: este agendamento não pertence a você.');
        }
        validarAntecedenciaCancelamento(agendamento.data_hora);
        return await agendamentoRepository.deletar(id);
    }

    async concluir(id, idAluno) {
        const agendamento = await agendamentoRepository.buscarPorId(id);
        if (!agendamento) {
            throw new Error('Agendamento não encontrado.');
        }
        if (agendamento.status === 'concluido') {
            throw new Error('Este agendamento já foi concluído.');
        }

        const [agendamentoAtualizado] = await agendamentoRepository.concluirEIncrementarPontos(
            id,
            idAluno
        );
        return agendamentoAtualizado;
    }
}

module.exports = new AgendamentoService();
