// src/controllers/autenticacaoController.js
const autenticacaoService = require('../services/autenticacaoService');
const tratarErro          = require('../utils/tratarErro');
console.log('✅ autenticacaoController v2 carregado');

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
            res.status(201).json({
                success: true,
                mensagem: 'Conta criada com sucesso!',
                id: usuario.id
            });
        } catch (error) {
            console.log('❌ ERRO CADASTRO código:', error.code);
            console.log('❌ ERRO CADASTRO mensagem:', error.message);
            console.log('❌ ERRO CADASTRO meta:', error.meta);
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
            const mensagem = tratarErro(error, {
                naoEncontrado: 'Usuário não encontrado. Verifique suas credenciais.',
                default:       'Não foi possível realizar o login. Tente novamente.'
            });
            res.status(401).json({ success: false, erro: mensagem });
        }
    }
}

module.exports = new AutenticacaoController();