// src/controllers/autenticacaoController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
// Tarefa 9: os corpos já chegam validados por schemas/autenticacaoSchemas.js.
const autenticacaoService = require('../services/autenticacaoService');
const redefinicaoSenhaService = require('../services/redefinicaoSenhaService');
const confirmacaoEmailService = require('../services/confirmacaoEmailService');
const { ErroCredenciaisInvalidas } = require('../utils/erros');
const logger = require('../utils/logger');
const { mascararIdentificador } = require('../utils/mascararIdentificador');
const {
    NOME_COOKIE_SESSAO,
    DURACAO_SESSAO_SEGUNDOS,
    opcoesCookieSessao
} = require('../config/sessao');

class AutenticacaoController {
    async cadastrar(req, res) {
        const usuario = await autenticacaoService.cadastrar(req.body);
        logger.info({ id: usuario.id, tipo_usuario: req.body.tipo_usuario }, 'Usuário cadastrado');
        res.status(201).json({
            success: true,
            mensagem: 'Conta criada. Enviamos um link para confirmar o seu e-mail.',
            id: usuario.id
        });
    }

    async login(req, res) {
        const { identificador, senha, tipo_usuario } = req.body;

        try {
            const { token, usuario } = await autenticacaoService.login(
                identificador,
                senha,
                tipo_usuario
            );
            // P3 (R7): a sessão vai só no cookie httpOnly; o corpo não leva o token
            res.cookie(NOME_COOKIE_SESSAO, token, {
                ...opcoesCookieSessao,
                maxAge: DURACAO_SESSAO_SEGUNDOS * 1000
            });
            res.json({ success: true, usuario });
        } catch (error) {
            if (error instanceof ErroCredenciaisInvalidas) {
                logger.warn(
                    { identificador: mascararIdentificador(identificador), tipo_usuario },
                    'Tentativa de login falhou'
                );
            }
            throw error;
        }
    }

    // POST /auth/senha/esqueci (RF-008): a resposta é sempre a mesma, exista a conta ou não
    async esqueciSenha(req, res) {
        await redefinicaoSenhaService.pedir(req.body.email, req.body.tipo_usuario);
        res.json({
            success: true,
            mensagem:
                'Se existir uma conta com esse e-mail, enviamos um link para criar uma senha nova.'
        });
    }

    // POST /auth/senha/redefinir (RF-008, RN-009): grava a senha nova e encerra as sessões
    async redefinirSenha(req, res) {
        await redefinicaoSenhaService.redefinir(req.body.token, req.body.senha);
        // Quem redefiniu neste navegador também sai: entra de novo com a senha nova
        res.clearCookie(NOME_COOKIE_SESSAO, opcoesCookieSessao);
        res.json({ success: true, mensagem: 'Senha alterada. Entre com a senha nova.' });
    }

    // POST /auth/email/confirmar (RF-018): abre o link do e-mail e libera o login
    async confirmarEmail(req, res) {
        await confirmacaoEmailService.confirmar(req.body.token);
        res.json({ success: true, mensagem: 'E-mail confirmado. Agora você já pode entrar.' });
    }

    // POST /auth/email/reenviar (RF-018): a resposta é sempre a mesma, exista a conta ou não
    async reenviarConfirmacao(req, res) {
        await confirmacaoEmailService.reenviar(req.body.identificador, req.body.tipo_usuario);
        res.json({
            success: true,
            mensagem:
                'Se existir uma conta esperando confirmação, enviamos um link novo para o e-mail dela.'
        });
    }

    // POST /auth/email/corrigir (plano 14): troca o e-mail digitado errado e manda o link para ele
    async corrigirEmail(req, res) {
        const email = await autenticacaoService.corrigirEmail(req.body);
        res.json({
            success: true,
            mensagem: 'E-mail corrigido. Enviamos o link de confirmação para o endereço novo.',
            email
        });
    }

    // GET /auth/sessao: quem está logado (o JavaScript da página não lê mais o token)
    async sessao(req, res) {
        const { id, nome_completo, tipo } = req.usuario;
        res.set('Cache-Control', 'no-store');
        res.json({ success: true, usuario: { id, nome: nome_completo, tipo } });
    }

    // POST /auth/sair: revoga as sessões do usuário e apaga o cookie
    async sair(req, res) {
        await autenticacaoService.sair(req.usuario.id);
        res.clearCookie(NOME_COOKIE_SESSAO, opcoesCookieSessao);
        res.json({ success: true, mensagem: 'Sessão encerrada.' });
    }
}

module.exports = new AutenticacaoController();
