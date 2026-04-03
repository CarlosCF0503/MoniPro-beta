// src/routes/agendamentoRotas.js
const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const { autenticar } = require('../middlewares/autenticacaoMiddleware');

// app.js registra: app.use('/agendamentos', agendamentoRotas)
// Portanto as rotas aqui usam '/' e '/:id' — sem prefixo duplicado
router.post('/', autenticar, agendamentoController.criar);
router.get('/', autenticar, agendamentoController.listar);
router.delete('/:id', autenticar, agendamentoController.deletar);

module.exports = router;
