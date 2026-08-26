// src/routes/autenticacaoRotas.js
const express = require('express');
const ratelimit = require('express-rate-limit');
const router = express.Router();
const autenticacaoController = require('../controllers/autenticacaoController');

const authLimiter = ratelimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        erro: 'Muitas tentativas de login ou cadastro feitas a partir deste IP. Por favor, tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/cadastro', authLimiter, autenticacaoController.cadastrar);
router.post('/login', authLimiter, autenticacaoController.login);

module.exports = router;