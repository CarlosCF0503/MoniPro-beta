// src/controllers/perfilController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
const perfilService = require('../services/perfilService');
const privacidadeService = require('../services/privacidadeService');
const { NOME_COOKIE_SESSAO, opcoesCookieSessao } = require('../config/sessao');
const logger = require('../utils/logger');
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

    // DELETE /perfil (R3): anonimiza a conta, revoga as sessões e apaga o cookie
    async excluirConta(req, res) {
        await privacidadeService.excluirConta(req.usuario.id, req.body.senha);
        logger.info({ id: req.usuario.id }, 'Conta excluída (anonimizada) a pedido do titular');
        res.clearCookie(NOME_COOKIE_SESSAO, opcoesCookieSessao);
        res.json({ success: true, mensagem: 'Sua conta foi excluída.' });
    }
}

module.exports = new PerfilController();
