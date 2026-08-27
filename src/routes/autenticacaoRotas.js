// autenticacaoRotas.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const autenticacaoController = require('../controllers/autenticacaoController');
const disciplinaController = require('../controllers/disciplinaController'); // ← adicionar

// Limita tentativas de login/cadastro por IP para dificultar força bruta
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' }
});

router.post('/cadastro', authLimiter, autenticacaoController.cadastrar);
router.post('/login', authLimiter, autenticacaoController.login);

// ✅ Rota pública — sem middleware 'autenticar', pois é a tela de escolha inicial
router.get('/disciplinas', disciplinaController.listar);

module.exports = router;
