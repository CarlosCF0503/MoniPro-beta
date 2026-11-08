// src/routes/agendamentoRotas.js
const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const { autenticar, isMonitor } = require('../middlewares/autenticacaoMiddleware');
const validarCorpo = require('../middlewares/validarCorpo');
const { criarAgendamentoSchema } = require('../schemas/agendamentoSchemas');

// app.js registra: app.use('/agendamentos', agendamentoRotas)
// Portanto as rotas aqui usam '/' e '/:id' — sem prefixo duplicado
router.post('/', autenticar, validarCorpo(criarAgendamentoSchema), agendamentoController.criar);
router.get('/', autenticar, agendamentoController.listar);
router.delete('/:id', autenticar, agendamentoController.deletar);
// P2 (R4): quem confirma a presença é o monitor dono da vaga, não o aluno
router.patch('/:id/concluir', autenticar, isMonitor, agendamentoController.concluir);

module.exports = router;
