// autenticacaoRotas.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const autenticacaoController = require('../controllers/autenticacaoController');
const validarCorpo = require('../middlewares/validarCorpo');
const { autenticar } = require('../middlewares/autenticacaoMiddleware');
const {
    cadastroSchema,
    loginSchema,
    esqueciSenhaSchema,
    redefinirSenhaSchema
} = require('../schemas/autenticacaoSchemas');
const {
    limiteTentativasAuth,
    limitePedidosSenhaPorEmail,
    limitePedidosSenhaPorIp
} = require('../config/limites');

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

// RF-008 (recuperar senha). O pedido de link tem limites próprios, por hora: por IP (antes da
// validação) e por conta (e-mail + tipo, depois dela). A resposta do limite é a mesma exista a
// conta ou não. A troca da senha usa o mesmo limite de login/cadastro.
const UMA_HORA = 60 * 60 * 1000;
const MENSAGEM_LIMITE_SENHA = {
    erro: 'Muitos pedidos de redefinição. Espere um pouco e tente de novo.'
};
const limiteSenhaPorIp = rateLimit({
    windowMs: UMA_HORA,
    max: limitePedidosSenhaPorIp(),
    standardHeaders: true,
    legacyHeaders: false,
    message: MENSAGEM_LIMITE_SENHA
});
const limiteSenhaPorEmail = rateLimit({
    windowMs: UMA_HORA,
    max: limitePedidosSenhaPorEmail(),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${req.body.tipo_usuario}:${req.body.email.toLowerCase()}`,
    message: MENSAGEM_LIMITE_SENHA
});
router.post(
    '/senha/esqueci',
    limiteSenhaPorIp,
    validarCorpo(esqueciSenhaSchema),
    limiteSenhaPorEmail,
    autenticacaoController.esqueciSenha
);
router.post(
    '/senha/redefinir',
    authLimiter,
    validarCorpo(redefinirSenhaSchema),
    autenticacaoController.redefinirSenha
);

// P3 (R7): sessão em cookie httpOnly
router.get('/sessao', autenticar, autenticacaoController.sessao);
router.post('/sair', autenticar, autenticacaoController.sair);

// Tarefa 32: a listagem de disciplinas existe só em GET /disciplinas (exige token). A antiga
// GET /auth/disciplinas, pública e sem uso no frontend, foi removida para manter uma única
// política de acesso para o mesmo recurso.

module.exports = router;
