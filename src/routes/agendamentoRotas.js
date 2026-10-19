// src/routes/agendamentoRotas.js
const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const { autenticar } = require('../middlewares/autenticacaoMiddleware');
const validarCorpo = require('../middlewares/validarCorpo');
const { criarAgendamentoSchema } = require('../schemas/agendamentoSchemas');

// app.js registra: app.use('/agendamentos', agendamentoRotas)
// Portanto as rotas aqui usam '/' e '/:id' — sem prefixo duplicado
router.post('/', autenticar, validarCorpo(criarAgendamentoSchema), agendamentoController.criar);
router.get('/', autenticar, agendamentoController.listar);
router.delete('/:id', autenticar, agendamentoController.deletar);
router.patch('/:id/concluir', autenticar, agendamentoController.concluir);

module.exports = router;
