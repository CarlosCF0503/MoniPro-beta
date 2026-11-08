// R1 (E2E): datas no horário de Brasília e navegação no calendário das telas de monitoria.
const { expect } = require('@playwright/test');

const FUSO = 'America/Sao_Paulo';
const HORA = 60 * 60 * 1000;

function partesEmBrasilia(data) {
    const partes = new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO,
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).formatToParts(data);
    const valor = (tipo) => partes.find((p) => p.type === tipo).value;
    return { dia: Number(valor('day')), mes: valor('month'), ano: Number(valor('year')) };
}

/**
 * Data `dias` à frente de hoje, às `hora`:`minuto` de Brasília (UTC-3, sem horário de verão).
 */
function diaAFrente(dias, hora = 14, minuto = 0) {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
    const [a, m, d] = hoje.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d + dias, hora + 3, minuto));
}

/** "14:00", como as telas mostram o horário. */
function horaMinuto(data) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO,
        hour: '2-digit',
        minute: '2-digit'
    }).format(data);
}

/**
 * Leva o calendário até o mês da data (o dia pode estar no mês seguinte) e devolve o botão
 * do dia. Funciona nas duas telas (aluno e monitor) e nos dois layouts, porque usa o nome
 * acessível dos botões ("12 de novembro, 1 horário").
 * @param {import('@playwright/test').Page} page
 */
async function botaoDoDia(page, data) {
    const { dia, mes, ano } = partesEmBrasilia(data);
    const titulo = new RegExp(`^${mes} ${ano}$`, 'i');
    const tituloMes = page.getByRole('heading', { level: 3, name: /\d{4}$/ });
    for (let i = 0; i < 3; i += 1) {
        if (titulo.test((await tituloMes.textContent()).trim())) break;
        await page.getByRole('button', { name: 'Próximo mês' }).click();
    }
    await expect(tituloMes).toHaveText(titulo);
    return page.getByRole('button', { name: new RegExp(`^${dia} de ${mes}(,|$)`) });
}

async function escolherDia(page, data) {
    await (await botaoDoDia(page, data)).click();
}

/**
 * Depois de escolher o horário, abre a revisão: no computador o botão é "Agendar monitoria";
 * no celular (passo a passo) é "Continuar".
 */
async function irParaRevisao(page) {
    await page.getByRole('button', { name: /^(Agendar monitoria|Continuar)$/ }).click();
    return page.getByRole('region', { name: 'Revise antes de confirmar' });
}

module.exports = {
    HORA,
    diaAFrente,
    horaMinuto,
    partesEmBrasilia,
    botaoDoDia,
    escolherDia,
    irParaRevisao
};
