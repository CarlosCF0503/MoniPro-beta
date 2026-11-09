// src/routes/perfilRotas.js
const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const { autenticar } = require('../middlewares/autenticacaoMiddleware');
const validarCorpo = require('../middlewares/validarCorpo');
const { excluirContaSchema } = require('../schemas/perfilSchemas');

// app.js registra: app.use('/perfil', perfilRotas)
// Todas as rotas de perfil exigem autenticação
router.get('/', autenticar, perfilController.exibir);
router.get('/agendamentos', autenticar, perfilController.listarAgendamentos);
router.get('/monitorias', autenticar, perfilController.listarMonitorias);
// R3 (LGPD): o titular exclui a própria conta (anonimização), confirmando a senha
router.delete('/', autenticar, validarCorpo(excluirContaSchema), perfilController.excluirConta);

module.exports = router;
