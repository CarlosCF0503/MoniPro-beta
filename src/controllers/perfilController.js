// src/controllers/perfilController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
const perfilService = require('../services/perfilService');
const { obterParametrosPaginacao, montarPaginacao } = require('../utils/paginacao');

class PerfilController {
    async exibir(req, res) {
        const perfil = await perfilService.obter(req.usuario.id);
        res.json({ success: true, user: perfil });
    }

    async listarAgendamentos(req, res) {
        const paginacao = obterParametrosPaginacao(req.query);
        const { dados, total } = await perfilService.obterAgendamentos(req.usuario.id, paginacao);
        res.json({
            success: true,
            agendamentos: dados,
            paginacao: montarPaginacao(paginacao, total)
        });
    }

    async listarMonitorias(req, res) {
        const paginacao = obterParametrosPaginacao(req.query);
        const { dados, total } = await perfilService.obterMonitorias(req.usuario.id, paginacao);
        res.json({
            success: true,
            monitorias: dados,
            paginacao: montarPaginacao(paginacao, total)
        });
    }
}

module.exports = new PerfilController();
