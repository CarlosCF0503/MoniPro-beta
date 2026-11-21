// src/utils/recorrencia.js
// Plano 9 (RF-014): datas de uma vaga semanal. Cada ocorrência fica 7 dias depois da anterior,
// no mesmo horário; o Brasil não tem mais horário de verão, então somar 7 x 24h mantém a hora.
const { MAX_OCORRENCIAS, DIAS_ENTRE_OCORRENCIAS } = require('../config/recorrencia');

const DIA_MS = 24 * 60 * 60 * 1000;
const FUSO = 'America/Sao_Paulo';
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO });

/** Dia no fuso do campus, como "2026-11-24". */
function diaNoCampus(data) {
    return formatoDia.format(data);
}

/**
 * Horários da série, do primeiro até o dia `ate` ("AAAA-MM-DD", inclusive, no fuso do campus).
 * Para em MAX_OCORRENCIAS + 1 para quem chama saber que passou do limite sem gerar uma lista
 * enorme.
 */
function gerarOcorrencias(inicio, ate) {
    const lista = [];
    for (let k = 0; lista.length <= MAX_OCORRENCIAS; k += 1) {
        const data = new Date(inicio.getTime() + k * DIAS_ENTRE_OCORRENCIAS * DIA_MS);
        if (diaNoCampus(data) > ate) break;
        lista.push(data);
    }
    return lista;
}

module.exports = { gerarOcorrencias, diaNoCampus };
