// src/routes/perfilRotas.js
const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const autenticacaoMiddleware = require('../middlewares/autenticacaoMiddleware');

// app.js registra: app.use('/perfil', perfilRotas)
// Todas as rotas de perfil exigem autenticação
router.get('/', autenticacaoMiddleware, perfilController.exibir);
router.get('/agendamentos', autenticacaoMiddleware, perfilController.listarAgendamentos);
router.get('/monitorias', autenticacaoMiddleware, perfilController.listarMonitorias);

module.exports = router;
