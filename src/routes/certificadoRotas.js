// src/routes/certificadoRotas.js
// Certificados (RF-005). Prefixo novo: precisa estar no Nginx do servidor (hml e produção) e
// no e2e/pilha/gateway.conf.
const express = require('express');
const router = express.Router();
const certificadoController = require('../controllers/certificadoController');
const { autenticar, isMonitor } = require('../middlewares/autenticacaoMiddleware');

router.get('/elegibilidade', autenticar, isMonitor, certificadoController.elegibilidade);

module.exports = router;
