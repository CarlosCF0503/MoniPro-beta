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

// Certificados: assinar (com a coordenação no documento) e revogar com motivo
router.get('/certificados', painelController.certificados);
router.get('/certificados/:id/sessoes', painelController.sessoesDoCertificado);
router.post('/certificados/:id/assinar', painelController.assinarCertificado);
router.post('/certificados/:id/revogar', painelController.revogarCertificado);

// Disciplinas criadas por monitores: aprovar (publica) ou mesclar com uma aprovada
router.get('/disciplinas', painelController.disciplinas);
router.post('/disciplinas/:id/aprovar', painelController.aprovarDisciplina);
router.post('/disciplinas/:id/mesclar', painelController.mesclarDisciplina);

module.exports = router;
