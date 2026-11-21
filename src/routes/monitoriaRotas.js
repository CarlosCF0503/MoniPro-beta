// src/routes/monitoriaRotas.js
const express = require('express');
const router = express.Router();
const monitoriaController = require('../controllers/monitoriaController');
const { autenticar, isMonitor } = require('../middlewares/autenticacaoMiddleware');
const validarCorpo = require('../middlewares/validarCorpo');
const {
    criarMonitoriaSchema,
    finalizarMonitoriaSchema,
    atualizarMonitoriaSchema
} = require('../schemas/monitoriaSchemas');

// app.js registra: app.use('/monitorias', monitoriaRotas)
router.post(
    '/',
    autenticar,
    isMonitor,
    validarCorpo(criarMonitoriaSchema),
    monitoriaController.criar
);

// Rotas específicas ANTES da rota com parâmetro (ordem importa no Express)
router.get('/monitor/agendamentos', autenticar, monitoriaController.listarAgendamentosDoMonitor);

// Plano 8 (RF-013): lista de espera de uma vaga lotada. Sair da fila é o DELETE /agendamentos/:id
router.post('/:id/espera', autenticar, monitoriaController.entrarNaFila);

// Rota de cancelar vaga — chamada pelo perfil.js do monitor
router.put('/:id/cancelar', autenticar, monitoriaController.cancelar);
// Plano 9: cancelar esta vaga e as próximas da mesma série
router.put('/:id/cancelar-proximas', autenticar, isMonitor, monitoriaController.cancelarProximas);

// Rota com parâmetro por último
router.get('/:idDisciplina', autenticar, monitoriaController.listar);

// Finalização da monitoria pelo monitor dono da vaga (informa a data/hora de término)
router.patch(
    '/:id/finalizar',
    autenticar,
    isMonitor,
    validarCorpo(finalizarMonitoriaSchema),
    monitoriaController.finalizar
);

// Editar vaga (RF-009): dia, horário, local, lugares e assunto, pelo monitor dono da vaga
router.patch(
    '/:id',
    autenticar,
    isMonitor,
    validarCorpo(atualizarMonitoriaSchema),
    monitoriaController.atualizar
);

module.exports = router;
