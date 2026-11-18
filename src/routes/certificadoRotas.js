// src/routes/certificadoRotas.js
// Certificados (RF-005). Prefixo novo: precisa estar no Nginx do servidor (hml e produção) e
// no e2e/pilha/gateway.conf.
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const certificadoController = require('../controllers/certificadoController');
const { autenticar, isMonitor } = require('../middlewares/autenticacaoMiddleware');
const { limiteVerificacoesPorMinuto } = require('../config/limites');

// Verificação pública: limite próprio, mais apertado que o geral (20 por minuto por IP)
const limiteVerificacao = rateLimit({
    windowMs: 60 * 1000,
    max: limiteVerificacoesPorMinuto(),
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas consultas seguidas. Espere um minuto e tente de novo.' }
});

router.get('/elegibilidade', autenticar, isMonitor, certificadoController.elegibilidade);
// Pública (sem login): dentro do prefixo /certificados para não criar outro no Nginx
router.get('/verificar/:codigo', limiteVerificacao, certificadoController.verificar);
router.get('/', autenticar, isMonitor, certificadoController.listar);
router.post('/', autenticar, isMonitor, certificadoController.emitir);
// Depois das rotas fixas: /:codigo pegaria "elegibilidade"
router.get('/:codigo', autenticar, certificadoController.abrir);

module.exports = router;
