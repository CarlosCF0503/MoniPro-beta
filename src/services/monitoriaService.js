// src/services/monitoriaService.js
const monitoriaRepository = require('../repositories/monitoriaRepository');
const { validarAntecedenciaCancelamento } = require('../utils/validarAntecedencia');

class MonitoriaService {
    async criar(dados) {
        return await monitoriaRepository.criar(dados);
    }

    async listarPorDisciplina(idDisciplina, paginacao) {
        const { dados, total } = await monitoriaRepository.buscarPorDisciplina(
            Number(idDisciplina),
            paginacao
        );

        // Tarefa 23: expõe vagas_disponiveis (capacidade - agendamentos já feitos)
        // para a lista do frontend indicar a ocupação de cada vaga.
        const dadosComVagas = dados.map((monitoria) => {
            const { _count, ...resto } = monitoria;
            const capacidade = typeof monitoria.capacidade === 'number' ? monitoria.capacidade : 1;
            const inscritos = _count?.inscricoes ?? 0;
            return {
                ...resto,
                capacidade,
                vagas_disponiveis: Math.max(capacidade - inscritos, 0)
            };
        });

        return { dados: dadosComVagas, total };
    }

    async buscarAgendamentosPorMonitor(monitorId, paginacao) {
        return await monitoriaRepository.buscarAgendamentos(monitorId, paginacao);
    }

    async cancelar(id, monitorId) {
        const monitoria = await monitoriaRepository.buscarPorId(id);
        if (!monitoria) {
            throw new Error('Monitoria não encontrada.');
        }
        if (monitoria.id_monitor !== monitorId) {
            throw new Error('Não autorizado: esta monitoria não pertence ao utilizador.');
        }
        validarAntecedenciaCancelamento(monitoria.horario);
        return await monitoriaRepository.cancelar(id);
    }

    async listarPorMonitor(monitorId, paginacao) {
        return await monitoriaRepository.buscarPorMonitor(monitorId, paginacao);
    }
}

module.exports = new MonitoriaService();
