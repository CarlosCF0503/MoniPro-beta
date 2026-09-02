const agendamentoRepository = require('../repositories/agendamentoRepository');

class AgendamentoService {
    async criar(dados) {
        // Impede agendamento duplicado para a mesma monitoria
        const jaExiste = await agendamentoRepository.buscarPorAlunoEMonitoria(
            dados.id_aluno,
            dados.id_monitoria
        );
        if (jaExiste) {
            throw new Error('Você já está inscrito nesta monitoria.');
        }
        return await agendamentoRepository.criar(dados);
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
        
        const [agendamentoAtualizado] = await agendamentoRepository.concluirEIncrementarPontos(id, idAluno);
        return agendamentoAtualizado;
    }
}

module.exports = new AgendamentoService();
