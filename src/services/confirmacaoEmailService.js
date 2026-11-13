// src/services/confirmacaoEmailService.js
// Plano 14 (RF-018, RN-017): confirmar o e-mail no cadastro.
// - O cadastro gera um link e manda para o e-mail informado; a conta só entra depois de abri-lo.
// - O link vale 48 horas e uma vez, e um pedido novo invalida os anteriores.
// - Pedir um link novo responde sempre igual, exista a conta ou não, já confirmada ou não: a
//   resposta não revela quais e-mails ou matrículas estão cadastrados.

const usuarioRepository = require('../repositories/usuarioRepository');
const tokenRepository = require('../repositories/tokenConfirmacaoRepository');
const email = require('./email');
const { urlDoApp } = require('../config/email');
const { HORAS_VALIDADE_CONFIRMACAO } = require('../config/confirmacaoEmail');
const { gerarToken, hashDoToken } = require('../utils/tokenDeUso');
const { ErroAplicacao } = require('../utils/erros');
const logger = require('../utils/logger');

// 410 Gone: o link existiu, mas não vale mais (vencido, usado ou trocado por um mais novo)
class ErroLinkConfirmacaoInvalido extends ErroAplicacao {
    constructor() {
        super('Este link de confirmação não vale mais. Peça um novo.', 410);
    }
}

class ConfirmacaoEmailService {
    /**
     * Gera o link de confirmação e manda por e-mail, sem esperar o envio.
     * @param {{id:number, nome_completo:string, email:string, tipo_usuario:string}} usuario
     */
    async gerar(usuario, agora = new Date()) {
        const token = gerarToken();
        const expiraEm = new Date(agora.getTime() + HORAS_VALIDADE_CONFIRMACAO * 60 * 60 * 1000);
        await tokenRepository.emTransacao(async (tx) => {
            await tokenRepository.invalidarAbertos(usuario.id, agora, tx);
            await tokenRepository.criar(
                { idUsuario: usuario.id, hash: hashDoToken(token), expiraEm },
                tx
            );
        });

        email.enviarSemEsperar({
            para: usuario.email,
            modelo: 'confirmar-email',
            dados: {
                nome: usuario.nome_completo,
                tipo: usuario.tipo_usuario,
                link: `${urlDoApp()}/confirmar_email.html?token=${token}`,
                horas: HORAS_VALIDADE_CONFIRMACAO
            }
        });
        logger.info({ id: usuario.id }, 'Link de confirmação de e-mail gerado');
    }

    async confirmar(token, agora = new Date()) {
        const idUsuario = await tokenRepository.emTransacao(async (tx) => {
            const id = await tokenRepository.consumir(hashDoToken(token), agora, tx);
            if (!id) throw new ErroLinkConfirmacaoInvalido();
            await tokenRepository.marcarConfirmado(id, agora, tx);
            return id;
        });
        logger.info({ id: idUsuario }, 'E-mail confirmado pelo link');
    }

    // Pela tela de login (e-mail ou matrícula) ou pela tela "confira seu e-mail" do cadastro
    async reenviar(identificador, tipoUsuario, agora = new Date()) {
        const id = String(identificador).trim();
        let usuario = null;
        if (id.includes('@')) usuario = await usuarioRepository.buscarPorEmail(id, tipoUsuario);
        else if (/^\d+$/.test(id))
            usuario = await usuarioRepository.buscarPorMatricula(Number(id), tipoUsuario);
        // Sem conta, conta já confirmada ou anonimizada (R3): nada a enviar, mesma resposta
        if (!usuario || usuario.email_confirmado_em || usuario.anonimizado_em) return;
        await this.gerar(usuario, agora);
    }
}

module.exports = new ConfirmacaoEmailService();
module.exports.ErroLinkConfirmacaoInvalido = ErroLinkConfirmacaoInvalido;
