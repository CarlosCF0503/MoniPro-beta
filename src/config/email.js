// src/config/email.js
// Configuração do envio de e-mail (base dos planos 1 e 3). O provedor escolhido é o Brevo, mas o
// código só fala SMTP: trocar de provedor é trocar as variáveis do .env do servidor.
//
// EMAIL_TRANSPORTE escolhe como o e-mail sai:
//   smtp     - envia de verdade (exige SMTP_HOST, SMTP_USUARIO, SMTP_SENHA e EMAIL_REMETENTE)
//   console  - só registra no log que um e-mail seria enviado (desenvolvimento local)
//   memoria  - guarda na memória do processo (testes)
// Sem a variável: memoria nos testes, smtp quando SMTP_HOST existe, console nos demais casos.

function transporteEmail(env = process.env) {
    const escolhido = (env.EMAIL_TRANSPORTE || '').trim().toLowerCase();
    if (['smtp', 'console', 'memoria'].includes(escolhido)) return escolhido;
    if (env.NODE_ENV === 'test') return 'memoria';
    return env.SMTP_HOST ? 'smtp' : 'console';
}

function configSmtp(env = process.env) {
    const porta = Number(env.SMTP_PORTA) || 587; // a Oracle bloqueia a 25; o Brevo aceita 587
    return {
        host: env.SMTP_HOST,
        port: porta,
        // 465 usa TLS desde o início; 587 começa em texto e sobe para TLS (STARTTLS obrigatório)
        secure: porta === 465,
        requireTLS: porta !== 465,
        auth: { user: env.SMTP_USUARIO, pass: env.SMTP_SENHA }
    };
}

// Endereço público do frontend, usado nos links e na logo dos e-mails. O certo é definir APP_URL
// no .env de cada servidor. Sem ela, vale a primeira origem de ALLOWED_ORIGINS que não seja local
// (localhost/127.0.0.1 só serve para quem está na própria máquina); se só houver locais, a primeira.
const ORIGEM_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

function urlDoApp(env = process.env) {
    const explicita = (env.APP_URL || '').trim();
    const origens = (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    const publica = origens.find((o) => !ORIGEM_LOCAL.test(o));
    return (explicita || publica || origens[0] || 'https://moni-pro.app.br').replace(/\/+$/, '');
}

function remetente(env = process.env) {
    return env.EMAIL_REMETENTE || 'MoniPro <nao-responda@moni-pro.app.br>';
}

module.exports = { transporteEmail, configSmtp, urlDoApp, remetente };
