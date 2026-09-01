// src/controllers/autenticacaoController.js
const autenticacaoService = require('../services/autenticacaoService');
const tratarErro = require('../utils/tratarErro');
const logger = require('../utils/logger');

class AutenticacaoController {
    async cadastrar(req, res) {
        const { nome_completo, email, matricula, senha, tipo_usuario } = req.body;

        if (!nome_completo || !email || !matricula || !senha || !tipo_usuario) {
            return res.status(400).json({
                success: false,
                erro: 'Preencha todos os campos obrigatórios.'
            });
        }

        try {
            const usuario = await autenticacaoService.cadastrar(req.body);
            logger.info({ id: usuario.id, tipo_usuario }, 'Usuário cadastrado');
            res.status(201).json({
                success: true,
                mensagem: 'Conta criada com sucesso!',
                id: usuario.id
            });
        } catch (error) {
            logger.error(
                { code: error.code, message: error.message, meta: error.meta },
                'Erro ao cadastrar usuário'
            );
            const mensagem = tratarErro(error, {
                default: 'Não foi possível criar a conta. Tente novamente.'
            });
            res.status(400).json({ success: false, erro: mensagem });
        }
    }

    async login(req, res) {
        const { identificador, senha, tipo_usuario } = req.body;

        if (!identificador || !senha || !tipo_usuario) {
            return res.status(400).json({
                success: false,
                erro: 'Preencha e-mail/matrícula, senha e tipo de usuário.'
            });
        }

        try {
            const resultado = await autenticacaoService.login(identificador, senha, tipo_usuario);
            res.json(resultado);
        } catch (error) {
            logger.warn({ identificador, tipo_usuario }, 'Tentativa de login falhou');
            const mensagem = tratarErro(error, {
                naoEncontrado: 'Usuário não encontrado. Verifique suas credenciais.',
                default: 'Não foi possível realizar o login. Tente novamente.'
            });
            res.status(401).json({ success: false, erro: mensagem });
        }
    }
}

module.exports = new AutenticacaoController();
