// src/routes/pontosRotas.js
// Plano 5 (RF-011): extrato dos próprios pontos. Cada um vê só o seu (id vem da sessão).
const express = require('express');
const router = express.Router();
const pontosController = require('../controllers/pontosController');
const { autenticar } = require('../middlewares/autenticacaoMiddleware');

router.get('/extrato', autenticar, pontosController.extrato);

module.exports = router;
