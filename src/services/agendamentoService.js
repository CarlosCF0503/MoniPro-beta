const agendamentoRepository = require('../repositories/agendamentoRepository');

class MonitoriaLotadaError extends Error {
    constructor() {
        super('Esta vaga de monitoria está lotada.');
        this.name = 'MonitoriaLotadaError';
        this.code = 'MONITORIA_LOTADA';
    }
}

class AgendamentoService {
    async criar(dados) {
        // Duplicidade e capacidade são verificadas na mesma transação, com a linha da monitoria
        // travada, para que inscrições simultâneas não ultrapassem o limite de vagas.
        return await agendamentoRepository.emTransacao(async (tx) => {
            const monitoria = await agendamentoRepository.bloquearMonitoria(dados.id_monitoria, tx);
            if (!monitoria) {
                throw new Error('Monitoria não encontrada.');
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

            const ocupadas = await agendamentoRepository.contarOcupadas(dados.id_monitoria, tx);
            if (ocupadas >= monitoria.capacidade) {
                throw new MonitoriaLotadaError();
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
