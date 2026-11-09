// autenticacaoRotas.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const autenticacaoController = require('../controllers/autenticacaoController');
const validarCorpo = require('../middlewares/validarCorpo');
const { autenticar } = require('../middlewares/autenticacaoMiddleware');
const { cadastroSchema, loginSchema } = require('../schemas/autenticacaoSchemas');
const { limiteTentativasAuth } = require('../config/limites');

// Limita tentativas de login/cadastro por IP para dificultar força bruta (padrão: 10; ver
// src/config/limites.js)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: limiteTentativasAuth(),
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' }
});

router.post(
    '/cadastro',
    authLimiter,
    validarCorpo(cadastroSchema),
    autenticacaoController.cadastrar
);
router.post('/login', authLimiter, validarCorpo(loginSchema), autenticacaoController.login);

// P3 (R7): sessão em cookie httpOnly
router.get('/sessao', autenticar, autenticacaoController.sessao);
router.post('/sair', autenticar, autenticacaoController.sair);

// Tarefa 32: a listagem de disciplinas existe só em GET /disciplinas (exige token). A antiga
// GET /auth/disciplinas, pública e sem uso no frontend, foi removida para manter uma única
// política de acesso para o mesmo recurso.

module.exports = router;
