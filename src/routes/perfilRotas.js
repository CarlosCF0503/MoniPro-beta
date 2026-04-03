// src/routes/perfilRotas.js
const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const { autenticar } = require('../middlewares/autenticacaoMiddleware');

// app.js registra: app.use('/perfil', perfilRotas)
// Todas as rotas de perfil exigem autenticação
router.get('/', autenticar, perfilController.exibir);
router.get('/agendamentos', autenticar, perfilController.listarAgendamentos);
router.get('/monitorias', autenticar, perfilController.listarMonitorias);

module.exports = router;
