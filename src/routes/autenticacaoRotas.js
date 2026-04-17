// autenticacaoRotas.js
const express = require('express');
const router = express.Router();
const autenticacaoController = require('../controllers/autenticacaoController');
const disciplinaController = require('../controllers/disciplinaController'); // ← adicionar

router.post('/cadastro', autenticacaoController.cadastrar);
router.post('/login', autenticacaoController.login);

// ✅ Rota pública — sem middleware 'autenticar', pois é a tela de escolha inicial
router.get('/disciplinas', disciplinaController.listar);

module.exports = router;
