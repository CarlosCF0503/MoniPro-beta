// src/controllers/perfilController.js
const perfilService = require('../services/perfilService');
const tratarErro    = require('../utils/tratarErro');

class PerfilController {
    async exibir(req, res) {
        try {
            const perfil = await perfilService.obter(req.usuario.id);
            res.json({ success: true, user: perfil });
        } catch (error) {
            console.error('❌ Erro ao buscar perfil:', error);
            const mensagem = tratarErro(error, {
                naoEncontrado: 'Perfil não encontrado. Faça login novamente.',
                default:       'Não foi possível carregar o perfil. Tente novamente.'
            });
            res.status(404).json({ success: false, erro: mensagem });
        }
    }

    async listarAgendamentos(req, res) {
        try {
            const agendamentos = await perfilService.obterAgendamentos(req.usuario.id);
            res.json({ success: true, agendamentos });
        } catch (error) {
            console.error('❌ Erro ao listar agendamentos do perfil:', error);
            res.status(500).json({
                success: false,
                erro: 'Não foi possível carregar seus agendamentos. Tente novamente.'
            });
        }
    }

    async listarMonitorias(req, res) {
        try {
            const monitorias = await perfilService.obterMonitorias(req.usuario.id);
            res.json({ success: true, monitorias });
        } catch (error) {
            console.error('❌ Erro ao listar monitorias do perfil:', error);
            res.status(500).json({
                success: false,
                erro: 'Não foi possível carregar suas monitorias. Tente novamente.'
            });
        }
    }
}

module.exports = new PerfilController();
