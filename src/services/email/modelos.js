// src/services/email/modelos.js
// Modelos dos e-mails transacionais. Cada modelo recebe os dados e devolve { assunto, texto, html }.
// O HTML usa tabelas com estilo inline, que é o que os clientes de e-mail aceitam, e todo texto
// variável passa por escapar(). A versão em texto puro vai junto para quem não lê HTML.
// O visual segue a prévia dos e-mails do plano 3.

const { urlDoApp } = require('../../config/email');
const { PONTOS_ALUNO } = require('../../utils/regrasConclusao');

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

// ---------- Plano 3 (RF-010): avisos sobre monitorias ----------
// Horários no fuso do campus, por extenso ("sexta, 13/11, às 15:00") e curto ("sex 13/11 às 15:00")
const FUSO = 'America/Sao_Paulo';
const partes = (iso, opcoes) =>
    Object.fromEntries(
        new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...opcoes })
            .formatToParts(new Date(iso))
            .map((p) => [p.type, p.value])
    );
function quandoPorExtenso(iso) {
    const p = partes(iso, {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    });
    return `${p.weekday.replace('-feira', '')}, ${p.day}/${p.month}, às ${p.hour}:${p.minute}`;
}
function quandoCurto(iso) {
    const p = partes(iso, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    });
    return `${p.weekday.replace('.', '')} ${p.day}/${p.month} às ${p.hour}:${p.minute}`;
}
const diaCurto = (iso) => quandoCurto(iso).split(' às ')[0];
const horaDe = (iso) => quandoCurto(iso).split(' às ')[1];

// Quadro "Disciplina / Monitor / Quando / Local". Valor com antes → depois mostra os dois.
function quadro(linhas) {
    const tr = linhas
        .map(
            ([rotulo, valor]) =>
                `<tr><td style="padding:7px 12px 7px 0;font-size:13px;color:${COR.suave};white-space:nowrap;vertical-align:top">${escapar(rotulo)}</td>` +
                `<td style="padding:7px 0;font-size:15px;color:${COR.navy};font-weight:600">${valor}</td></tr>`
        )
        .join('');
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 14px;border-top:1px solid ${COR.linha};border-bottom:1px solid ${COR.linha}">${tr}</table>`;
}
const textoQuadro = (linhas) => linhas.map(([r, v]) => `${r}: ${v}`).join('\n');
const mudou = (antes, depois) =>
    antes
        ? `<span style="color:${COR.suave};font-weight:400;text-decoration:line-through">${escapar(antes)}</span> → ${escapar(depois)}`
        : escapar(depois);

const RODAPE_AVISO =
    'Você recebe este e-mail porque tem uma inscrição no MoniPro. Avisos sobre suas monitorias não podem ser desligados, porque fazem parte do serviço.';

// Monta o e-mail de aviso: linhas = [rótulo, valor em texto, valor em HTML opcional]
function aviso({ assunto, titulo, abertura, linhas, depois, acao }) {
    const app = urlDoApp();
    const htmlLinhas = linhas.map(([r, t, h]) => [r, h ?? escapar(t)]);
    const textoLinhas = linhas.map(([r, t]) => [r, t]);
    return {
        assunto,
        texto: `${abertura}\n\n${textoQuadro(textoLinhas)}\n\n${depois}\n\n${acao.texto}: ${app}/${acao.pagina}\n\nMoniPro`,
        html: casca({
            titulo,
            corpo:
                paragrafo(escapar(abertura)) +
                quadro(htmlLinhas) +
                paragrafo(escapar(depois), `font-size:14px`) +
                botao(acao.texto, `${app}/${acao.pagina}`),
            rodape: RODAPE_AVISO
        })
    };
}

const PERFIL = { texto: 'Ver no meu perfil', pagina: 'perfil_aluno.html' };

MODELOS.inscricao = (d) => {
    const prazo = new Date(new Date(d.horario).getTime() - 24 * 60 * 60 * 1000).toISOString();
    return aviso({
        assunto: `Inscrição confirmada: ${d.disciplina}, ${quandoCurto(d.horario)}`,
        titulo: 'Você está inscrito',
        abertura: `Olá, ${primeiroNome(d.nome)}. Sua inscrição na monitoria foi confirmada.`,
        linhas: [
            ['Disciplina', d.disciplina],
            ['Monitor', d.monitor],
            ['Quando', quandoPorExtenso(d.horario)],
            ['Local', d.local],
            ...(d.assunto ? [['Assunto', d.assunto]] : [])
        ],
        depois: `Você pode cancelar até ${quandoPorExtenso(prazo)} (24h antes).`,
        acao: PERFIL
    });
};

MODELOS.lembrete = (d) =>
    aviso({
        assunto: `Amanhã às ${horaDe(d.horario)}: monitoria de ${d.disciplina}`,
        titulo: 'Sua monitoria é amanhã',
        abertura: `Olá, ${primeiroNome(d.nome)}. Lembrete da sua monitoria:`,
        linhas: [
            ['Disciplina', d.disciplina],
            ['Monitor', d.monitor],
            ['Quando', quandoPorExtenso(d.horario)],
            ['Local', d.local],
            ...(d.assunto ? [['Assunto', d.assunto]] : [])
        ],
        depois: `Leve suas dúvidas anotadas. Depois da sessão, confirme sua presença no perfil para ganhar +${PONTOS_ALUNO} pontos.`,
        acao: PERFIL
    });

MODELOS['vaga-alterada'] = (d) => {
    const mudouQuando = Boolean(d.horario_anterior);
    const mudouLocal = Boolean(d.local_anterior);
    let oQue = 'o horário e o local';
    if (!mudouLocal) oQue = 'o horário';
    else if (!mudouQuando) oQue = 'o local';
    const quando = quandoPorExtenso(d.horario);
    const quandoAntes = mudouQuando ? quandoPorExtenso(d.horario_anterior) : null;
    return aviso({
        assunto: `Mudou ${oQue} da monitoria de ${d.disciplina}`,
        titulo: 'A monitoria mudou',
        abertura: `Olá, ${primeiroNome(d.nome)}. ${d.monitor}, responsável pela vaga, alterou ${oQue} da monitoria em que você está inscrito.`,
        linhas: [
            ['Disciplina', d.disciplina],
            [
                'Quando',
                mudouQuando ? `${quandoAntes} → ${quando}` : quando,
                mudou(quandoAntes, quando)
            ],
            [
                'Local',
                mudouLocal ? `${d.local_anterior} → ${d.local}` : d.local,
                mudou(d.local_anterior, d.local)
            ]
        ],
        depois: 'Se a mudança não serve para você, pode cancelar a inscrição a qualquer momento antes do início, sem a regra das 24h.',
        acao: PERFIL
    });
};

MODELOS['vaga-cancelada'] = (d) =>
    aviso({
        assunto: `Cancelada: monitoria de ${d.disciplina}, ${diaCurto(d.horario)}`,
        titulo: 'A monitoria foi cancelada',
        abertura: `Olá, ${primeiroNome(d.nome)}. ${d.monitor}, responsável pela vaga, cancelou a monitoria em que você estava inscrito.`,
        linhas: [
            ['Disciplina', d.disciplina],
            ['Era em', quandoPorExtenso(d.horario)],
            ['Local', d.local]
        ],
        depois: `Veja se há outros horários de ${d.disciplina} para marcar.`,
        acao: { texto: 'Ver outros horários', pagina: 'marcar_monitoria.html' }
    });

function montar(modelo, dados) {
    const gerar = MODELOS[modelo];
    if (!gerar) throw new Error(`Modelo de e-mail desconhecido: ${modelo}`);
    return gerar(dados);
}

module.exports = { montar, escapar, MODELOS };
