// src/services/monitoriaService.js
const monitoriaRepository = require('../repositories/monitoriaRepository');

class MonitoriaService {
    async criar(dados) {
        return await monitoriaRepository.criar(dados);
    }

    async listarPorDisciplina(idDisciplina) {
        return await monitoriaRepository.buscarPorDisciplina(Number(idDisciplina));
    }

    async buscarAgendamentosPorMonitor(monitorId) {
        return await monitoriaRepository.buscarAgendamentos(monitorId);
    }

    async cancelar(id, monitorId) {
        const monitoria = await monitoriaRepository.buscarPorId(id);
        if (!monitoria) {
            throw new Error('Monitoria não encontrada.');
        }
        if (monitoria.id_monitor !== monitorId) {
            throw new Error('Não autorizado: esta monitoria não pertence ao utilizador.');
        }
        return await monitoriaRepository.cancelar(id);
    }

    async listarPorMonitor(monitorId) {
        return await monitoriaRepository.buscarPorMonitor(monitorId);
    }
}

module.exports = new MonitoriaService();
