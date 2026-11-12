// src/services/redefinicaoSenhaService.js
// RF-008 / RN-009: recuperar a senha pelo e-mail.
// - O pedido responde sempre igual, exista a conta ou não, e o e-mail sai sem a resposta esperar
//   por ele: nem a mensagem nem o tempo revelam quais e-mails estão cadastrados.
// - O token tem 32 bytes aleatórios; o banco guarda só o SHA-256. Vale 30 minutos e uma vez, e
//   um pedido novo invalida os anteriores.
// - Trocar a senha encerra todas as sessões abertas (versao_token).

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const usuarioRepository = require('../repositories/usuarioRepository');
const tokenRepository = require('../repositories/tokenRedefinicaoRepository');
const email = require('./email');
const { urlDoApp } = require('../config/email');
const { ErroAplicacao } = require('../utils/erros');
const logger = require('../utils/logger');

const MINUTOS_VALIDADE = 30;

// 410 Gone: o link existiu, mas não vale mais (vencido, usado ou trocado por um mais novo)
class ErroLinkInvalido extends ErroAplicacao {
    constructor() {
        super('Este link de redefinição não vale mais. Peça um novo.', 410);
    }
}

const hashDoToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

class RedefinicaoSenhaService {
    async pedir(emailInformado, tipoUsuario, agora = new Date()) {
        const usuario = await usuarioRepository.buscarPorEmail(emailInformado, tipoUsuario);
        // Conta anonimizada (R3) não recebe link: o e-mail dela não existe mais
        if (!usuario || usuario.anonimizado_em) return;

        const token = crypto.randomBytes(32).toString('base64url');
        const expiraEm = new Date(agora.getTime() + MINUTOS_VALIDADE * 60 * 1000);
        await tokenRepository.emTransacao(async (tx) => {
            await tokenRepository.invalidarAbertos(usuario.id, agora, tx);
            await tokenRepository.criar(
                { idUsuario: usuario.id, hash: hashDoToken(token), expiraEm },
                tx
            );
        });

        email.enviarSemEsperar({
            para: usuario.email,
            modelo: 'redefinir-senha',
            dados: {
                nome: usuario.nome_completo,
                tipo: usuario.tipo_usuario,
                link: `${urlDoApp()}/redefinir_senha.html?token=${token}`,
                minutos: MINUTOS_VALIDADE
            }
        });
        logger.info({ id: usuario.id }, 'Link de redefinição de senha gerado');
    }

    async redefinir(token, senhaNova, agora = new Date()) {
        // O bcrypt roda fora da transação: é lento e não precisa segurar a linha do token
        const hashSenha = await bcrypt.hash(senhaNova, 10);
        const idUsuario = await tokenRepository.emTransacao(async (tx) => {
            const id = await tokenRepository.consumir(hashDoToken(token), agora, tx);
            if (!id) throw new ErroLinkInvalido();
            await tokenRepository.trocarSenha(id, hashSenha, tx);
            return id;
        });
        logger.info({ id: idUsuario }, 'Senha redefinida pelo link');
    }
}

module.exports = new RedefinicaoSenhaService();
module.exports.MINUTOS_VALIDADE = MINUTOS_VALIDADE;
module.exports.hashDoToken = hashDoToken;
