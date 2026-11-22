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
// P2 (R4): a presença vale quando os dois confirmam. O monitor dono da vaga confirma em
// /concluir e o aluno inscrito confirma a própria presença em /presenca.
router.patch('/:id/concluir', autenticar, isMonitor, agendamentoController.concluir);
router.patch('/:id/presenca', autenticar, agendamentoController.confirmarPresenca);
// Plano 12 (RN-016): o monitor dono da vaga marca a falta. Desfazer = confirmar a presença.
router.patch('/:id/ausencia', autenticar, isMonitor, agendamentoController.marcarAusencia);
// Plano 7: o aluno pede revisão da falta com comprovante (o corpo maior é aceito em app.js)
// O corpo (até 7 MB, com o comprovante em base64) só é lido depois do login; ver src/app.js
router.post(
    '/:id/recurso',
    autenticar,
    express.json({ limit: '7mb' }),
    agendamentoController.pedirRecurso
);
// Plano 6: o aluno avalia a monitoria (presença dos dois lados, até 7 dias depois)
router.post('/:id/avaliacao', autenticar, agendamentoController.avaliar);

module.exports = router;
