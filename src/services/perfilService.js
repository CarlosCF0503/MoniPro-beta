// src/services/perfilService.js
const perfilRepository = require('../repositories/perfilRepository');
const agendamentoRepository = require('../repositories/agendamentoRepository');
const monitoriaRepository = require('../repositories/monitoriaRepository');

class PerfilService {
    async obter(id) {
        const perfil = await perfilRepository.buscarPerfilCompleto(id);
        if (!perfil) {
            throw new Error('Perfil não encontrado na base de dados.');
        }
        return perfil;
    }

    async obterAgendamentos(idAluno) {
        return await agendamentoRepository.buscarPorAluno(idAluno);
    }

    async obterMonitorias(idMonitor) {
        return await monitoriaRepository.buscarPorMonitor(idMonitor);
    }
}

module.exports = new PerfilService();
