// src/routes/monitoriaRotas.js
const express = require('express');
const router = express.Router();
const monitoriaController = require('../controllers/monitoriaController');
const autenticacaoMiddleware = require('../middlewares/autenticacaoMiddleware');

// app.js registra: app.use('/monitorias', monitoriaRotas)
router.post('/', autenticacaoMiddleware, monitoriaController.criar);

// Rotas específicas ANTES da rota com parâmetro (ordem importa no Express)
router.get('/monitor/agendamentos', autenticacaoMiddleware, monitoriaController.listarAgendamentosDoMonitor);

// Rota de cancelar vaga — chamada pelo perfil.js do monitor
router.put('/:id/cancelar', autenticacaoMiddleware, monitoriaController.cancelar);

// Rota com parâmetro por último
router.get('/:idDisciplina', monitoriaController.listar);

module.exports = router;
