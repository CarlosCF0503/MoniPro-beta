// src/utils/periodo.js
// Plano 5: o ranking zera a cada semestre (decisão do time). AAAA.1 vai de janeiro a junho e
// AAAA.2 de julho a dezembro, no fuso do campus (o servidor roda em UTC).

const FUSO = 'America/Sao_Paulo';

function anoEMes(data) {
    const partes = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone: FUSO, year: 'numeric', month: 'numeric' })
            .formatToParts(new Date(data))
            .map((p) => [p.type, p.value])
    );
    return { ano: Number(partes.year), mes: Number(partes.month) };
}

/** Semestre de uma data: "2026.2" */
function periodoDe(data = new Date()) {
    const { ano, mes } = anoEMes(data);
    return `${ano}.${mes <= 6 ? 1 : 2}`;
}

/**
 * Início (inclusive) e fim (exclusivo) do semestre, como instantes. São Paulo está em UTC-3
 * o ano todo (sem horário de verão desde 2019).
 */
function limitesDoPeriodo(periodo) {
    const [ano, semestre] = periodo.split('.').map(Number);
    const inicio = new Date(Date.UTC(ano, semestre === 1 ? 0 : 6, 1, 3));
    const fim = new Date(Date.UTC(semestre === 1 ? ano : ano + 1, semestre === 1 ? 6 : 0, 1, 3));
    return { inicio, fim };
}

/** "2º semestre de 2026" */
function nomeDoPeriodo(periodo) {
    const [ano, semestre] = periodo.split('.');
    return `${semestre}º semestre de ${ano}`;
}

module.exports = { periodoDe, limitesDoPeriodo, nomeDoPeriodo };
