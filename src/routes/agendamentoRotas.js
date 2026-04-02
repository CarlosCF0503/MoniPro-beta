// src/routes/agendamentoRotas.js
const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const autenticacaoMiddleware = require('../middlewares/autenticacaoMiddleware');

// app.js registra: app.use('/agendamentos', agendamentoRotas)
// Portanto as rotas aqui usam '/' e '/:id' — sem prefixo duplicado
router.post('/', autenticacaoMiddleware, agendamentoController.criar);
router.get('/', autenticacaoMiddleware, agendamentoController.listar);
router.delete('/:id', autenticacaoMiddleware, agendamentoController.deletar);

module.exports = router;
