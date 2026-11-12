// scripts/testar-email.js
// Confere a configuração de e-mail (Brevo por SMTP) sem subir o sistema:
//   1. conecta no servidor SMTP e faz login com SMTP_USUARIO/SMTP_SENHA;
//   2. com um endereço no argumento, envia o e-mail "redefinir-senha" de exemplo para ele.
// Lê as variáveis do .env (ou do ambiente) e nunca imprime a senha.
//
// No servidor, dentro do container do backend:
//   docker-compose exec -T backend node scripts/testar-email.js
//   docker-compose exec -T backend node scripts/testar-email.js voce@exemplo.com
// No computador: SMTP_HOST=... SMTP_USUARIO=... SMTP_SENHA=... node scripts/testar-email.js

require('dotenv').config();
const nodemailer = require('nodemailer');
const { configSmtp, remetente, urlDoApp } = require('../src/config/email');
const { montar } = require('../src/services/email/modelos');

async function main() {
    const faltando = ['SMTP_HOST', 'SMTP_USUARIO', 'SMTP_SENHA'].filter((v) => !process.env[v]);
    if (faltando.length) {
        console.error(`Faltam variáveis: ${faltando.join(', ')}. Veja o .env.example.`);
        process.exitCode = 1;
        return;
    }
    const config = configSmtp();
    console.log(`SMTP ${config.host}:${config.port} como ${config.auth.user}`);
    const transporte = nodemailer.createTransport(config);
    await transporte.verify();
    console.log('Conexão e login no SMTP: ok');

    const destino = process.argv[2];
    if (!destino) {
        console.log(
            'Para enviar um e-mail de teste, passe o endereço: node scripts/testar-email.js voce@exemplo.com'
        );
        return;
    }
    const m = montar('redefinir-senha', {
        nome: 'Teste MoniPro',
        tipo: 'aluno',
        link: `${urlDoApp()}/redefinir_senha.html?token=teste-sem-validade`,
        minutos: 30
    });
    const info = await transporte.sendMail({
        from: remetente(),
        to: destino,
        subject: `[Teste] ${m.assunto}`,
        text: m.texto,
        html: m.html
    });
    console.log(
        `E-mail de teste aceito pelo Brevo (id ${info.messageId}), remetente ${remetente()}.`
    );
}

main().catch((erro) => {
    console.error('Falhou:', erro.message);
    process.exitCode = 1;
});
