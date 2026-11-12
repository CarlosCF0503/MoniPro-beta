// src/services/email/index.js
// Envio de e-mail atrás de uma única função: enviar({ para, modelo, dados }).
// Quem chama não sabe qual provedor está por trás (ver src/config/email.js).
// Em teste, os e-mails ficam em `enviados` (transporte de memória) para as asserções.

const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');
const { transporteEmail, configSmtp, remetente } = require('../../config/email');
const { montar } = require('./modelos');

const enviados = [];
let clienteSmtp = null;

function smtp() {
    clienteSmtp = clienteSmtp || nodemailer.createTransport(configSmtp());
    return clienteSmtp;
}

/**
 * Monta o e-mail pelo modelo e envia pelo transporte configurado.
 * @param {{ para: string, modelo: string, dados: object }} pedido
 */
async function enviar({ para, modelo, dados }) {
    const mensagem = montar(modelo, dados);
    const transporte = transporteEmail();

    if (transporte === 'memoria') {
        enviados.push({ para, modelo, dados, ...mensagem });
        return;
    }
    if (transporte === 'console') {
        // Nunca registra o destinatário nem o corpo: o corpo pode levar um link de acesso
        logger.info({ modelo }, 'E-mail não enviado (EMAIL_TRANSPORTE=console)');
        return;
    }
    await smtp().sendMail({
        from: remetente(),
        to: para,
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: mensagem.html
    });
    logger.info({ modelo }, 'E-mail enviado');
}

/**
 * Envia sem esperar e sem deixar a falha subir: para respostas que não podem depender do
 * provedor (por exemplo, "esqueci a senha" responde igual com ou sem conta).
 */
function enviarSemEsperar(pedido) {
    enviar(pedido).catch((erro) => {
        logger.error({ modelo: pedido.modelo, err: erro.message }, 'Falha ao enviar e-mail');
    });
}

module.exports = { enviar, enviarSemEsperar, enviados };
