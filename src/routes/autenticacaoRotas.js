// src/routes/autenticacaoRotas.js
const express = require('express');
const ratelimit = require('express-rate-limit');
const router = express.Router();
const autenticacaoController = require('../controllers/autenticacaoController');

// 1. Primeiro criamos o limitador
const authLimiter = ratelimit({
    windowMs: 15 * 60 * 1000, // tempo da janela: 15 min. em milissegundos
    max: 10,
    message: {
        erro: 'Muitas tentativas de login ou cadastro feitas a partir deste IP. Por favor, tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 2. Depois declaramos as rotas apenas UMA vez, injetando o limitador no meio
router.post('/cadastro', authLimiter, autenticacaoController.cadastrar);
router.post('/login', authLimiter, autenticacaoController.login);

module.exports = router;