// src/routes/autenticacaoRotas.js
const express = require('express');
const router = express.Router();
const autenticacaoController = require('../controllers/autenticacaoController');

// app.js registra: app.use('/auth', autenticacaoRotas)
router.post('/cadastro', autenticacaoController.cadastrar);
router.post('/login', autenticacaoController.login);

module.exports = router;
