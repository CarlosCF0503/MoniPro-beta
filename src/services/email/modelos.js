// src/services/email/modelos.js
// Modelos dos e-mails transacionais. Cada modelo recebe os dados e devolve { assunto, texto, html }.
// O HTML usa tabelas com estilo inline, que é o que os clientes de e-mail aceitam, e todo texto
// variável passa por escapar(). A versão em texto puro vai junto para quem não lê HTML.
// O visual segue a prévia dos e-mails do plano 3.

const { urlDoApp } = require('../../config/email');

const COR = {
    navy: '#071E3D',
    navy2: '#1F4287',
    texto: '#334155',
    suave: '#64748b',
    fundo: '#f4f6fb',
    linha: '#e2e8f0'
};

function escapar(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

const paragrafo = (html, estilo = '') =>
    `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${COR.texto};${estilo}">${html}</p>`;

function botao(texto, href) {
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr>' +
        `<td style="background:${COR.navy};border-radius:8px">` +
        `<a href="${escapar(href)}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">${escapar(texto)}</a>` +
        '</td></tr></table>'
    );
}

// Moldura comum: logo, título, corpo e rodapé com o motivo do envio e o Aviso de Privacidade
function casca({ titulo, corpo, rodape }) {
    const app = urlDoApp();
    return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};padding:24px 0;font-family:Inter,'Segoe UI',Arial,sans-serif"><tr><td align="center">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${COR.linha};border-radius:14px">` +
        `<tr><td style="padding:22px 28px;border-bottom:1px solid ${COR.linha}"><img src="${escapar(app)}/IMG/MoniPro_logo-menor.png" alt="MoniPro" height="34" style="display:block;height:34px;width:auto"></td></tr>` +
        `<tr><td style="padding:26px 28px 8px"><h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${COR.navy}">${escapar(titulo)}</h1>${corpo}</td></tr>` +
        `<tr><td style="padding:16px 28px 24px;font-size:12px;line-height:1.5;color:${COR.suave}">${escapar(rodape)}<br>` +
        `MoniPro · Monitorias acadêmicas · <a href="${escapar(app)}/privacidade.html" style="color:${COR.navy2}">Aviso de Privacidade</a></td></tr>` +
        '</table></td></tr></table>'
    );
}

const primeiroNome = (nome) =>
    String(nome || '')
        .trim()
        .split(/\s+/)[0] || 'olá';
const nomeDoTipo = (tipo) => (tipo === 'monitor' ? 'monitor' : 'aluno');

const MODELOS = {
    // Plano 1 (RF-008, RN-009)
    'redefinir-senha'({ nome, tipo, link, minutos }) {
        const ola = `Olá, ${primeiroNome(nome)}.`;
        const pedido = `Recebemos um pedido para trocar a senha da sua conta de ${nomeDoTipo(tipo)}.`;
        const aviso = `O link vale por ${minutos} minutos e só funciona uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.`;
        return {
            assunto: 'Seu link para criar uma senha nova',
            texto: `${ola} ${pedido}\n\nCriar senha nova: ${link}\n\n${aviso}\n\nMoniPro`,
            html: casca({
                titulo: 'Crie uma senha nova',
                corpo:
                    paragrafo(`${escapar(ola)} ${escapar(pedido)}`) +
                    botao('Criar senha nova', link) +
                    paragrafo(escapar(aviso), `font-size:13px;color:${COR.suave}`) +
                    paragrafo(
                        `Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${escapar(link)}</span>`,
                        `font-size:12px;color:${COR.suave}`
                    ),
                rodape: 'Este e-mail foi enviado porque alguém pediu a troca de senha da sua conta.'
            })
        };
    }
};

MODELOS['confirmar-email'] = ({ nome, tipo, link, horas }) => {
    // Plano 14 (RF-018, RN-017)
    const ola = `Olá, ${primeiroNome(nome)}.`;
    const pedido = `Falta só confirmar este e-mail para usar sua conta de ${nomeDoTipo(tipo)} no MoniPro.`;
    const aviso = `O link vale por ${horas} horas e só funciona uma vez. Se não foi você quem se cadastrou, ignore este e-mail: a conta é apagada sozinha em 7 dias.`;
    return {
        assunto: 'Confirme seu e-mail no MoniPro',
        texto: `${ola} ${pedido}

Confirmar e-mail: ${link}

${aviso}

MoniPro`,
        html: casca({
            titulo: 'Confirme seu e-mail',
            corpo:
                paragrafo(`${escapar(ola)} ${escapar(pedido)}`) +
                botao('Confirmar e-mail', link) +
                paragrafo(escapar(aviso), `font-size:13px;color:${COR.suave}`) +
                paragrafo(
                    `Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${escapar(link)}</span>`,
                    `font-size:12px;color:${COR.suave}`
                ),
            rodape: 'Este e-mail foi enviado porque alguém criou uma conta no MoniPro com este endereço.'
        })
    };
};

function montar(modelo, dados) {
    const gerar = MODELOS[modelo];
    if (!gerar) throw new Error(`Modelo de e-mail desconhecido: ${modelo}`);
    return gerar(dados);
}

module.exports = { montar, escapar, MODELOS };
