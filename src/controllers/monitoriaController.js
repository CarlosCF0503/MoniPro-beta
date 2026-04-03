// src/controllers/monitoriaController.js
const monitoriaService = require('../services/monitoriaService');
const tratarErro       = require('../utils/tratarErro');

class MonitoriaController {
    async criar(req, res) {
        const { id_disciplina, horario, local } = req.body;

        if (!id_disciplina || !horario || !local) {
            return res.status(400).json({
                success: false,
                erro: 'Disciplina, horário e local são obrigatórios para criar uma vaga.'
            });
        }

        try {
            const monitoria = await monitoriaService.criar({
                ...req.body,
                id_monitor: req.usuario.id
            });
            res.status(201).json({ success: true, monitoria });
        } catch (error) {
            console.error('❌ Erro ao criar monitoria:', error);
            const mensagem = tratarErro(error, {
                P2003:   'A disciplina informada não existe.',
                default: 'Não foi possível criar a vaga de monitoria. Tente novamente.'
            });
            res.status(400).json({ success: false, erro: mensagem });
        }
    }

    async listar(req, res) {
        try {
            const monitorias = await monitoriaService.listarPorDisciplina(req.params.idDisciplina);
            // Retorna array direto — frontend trata com Array.isArray()
            res.json(monitorias);
        } catch (error) {
            console.error('❌ Erro ao listar monitorias:', error);
            res.status(500).json({
                success: false,
                erro: 'Não foi possível carregar as monitorias. Tente novamente.'
            });
        }
    }

    async listarAgendamentosDoMonitor(req, res) {
        try {
            const agendamentos = await monitoriaService.buscarAgendamentosPorMonitor(req.usuario.id);
            res.json({ success: true, agendamentos });
        } catch (error) {
            console.error('❌ Erro ao buscar agendamentos do monitor:', error);
            res.status(500).json({
                success: false,
                erro: 'Não foi possível carregar os agendamentos. Tente novamente.'
            });
        }
    }

    async cancelar(req, res) {
        try {
            const monitoria = await monitoriaService.cancelar(parseInt(req.params.id), req.usuario.id);
            res.json({ success: true, mensagem: 'Vaga de monitoria cancelada com sucesso.', monitoria });
        } catch (error) {
            console.error('❌ Erro ao cancelar monitoria:', error);
            const mensagem = tratarErro(error, {
                naoEncontrado: 'Vaga de monitoria não encontrada.',
                naoAutorizado: 'Você não tem permissão para cancelar esta vaga.',
                default:       'Não foi possível cancelar a vaga. Tente novamente.'
            });
            const status = error.message?.includes('autorizado') ? 403 : 400;
            res.status(status).json({ success: false, erro: mensagem });
        }
    }
}

module.exports = new MonitoriaController();
