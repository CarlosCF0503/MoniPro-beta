// src/routes/painelRotas.js
// Plano 7 (RF-012, RN-014): painel da coordenação. Tudo exige login de coordenador; aluno e
// monitor recebem 403. Prefixo novo: precisa estar no Nginx do servidor (hml e produção) e no
// e2e/pilha/gateway.conf.
const express = require('express');
const router = express.Router();
const painelController = require('../controllers/painelController');
const { autenticar, isCoordenador } = require('../middlewares/autenticacaoMiddleware');

router.use(autenticar, isCoordenador);

router.get('/resumo', painelController.resumo);
router.get('/monitores', painelController.monitores);
router.get('/auditoria', painelController.auditoria);

module.exports = router;
