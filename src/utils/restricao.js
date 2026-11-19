// src/utils/restricao.js
// Plano 12 (RN-016): bloqueio por faltas, calculado na hora a partir das datas das ausências
// (sem tabela própria). FALTAS_PARA_BLOQUEAR faltas dentro de DIAS_JANELA dias bloqueiam novas
// inscrições por DIAS_BLOQUEIO dias, contados da falta que completou a conta.

const { FALTAS_PARA_BLOQUEAR, DIAS_JANELA, DIAS_BLOQUEIO } = require('../config/faltas');

const DIA = 24 * 60 * 60 * 1000;

/** Quantos dias para trás é preciso olhar para saber se alguém está bloqueado agora. */
const DIAS_CONSULTA = DIAS_JANELA + DIAS_BLOQUEIO;

/**
 * @param {Date[]} ausencias - datas em que o monitor marcou as faltas
 * @returns {{ ate: Date, faltas: number } | null} até quando está bloqueado, ou null
 */
function calcularRestricao(ausencias, agora = new Date()) {
    const datas = ausencias.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
    let ate = null;
    const n = FALTAS_PARA_BLOQUEAR - 1;
    for (let i = n; i < datas.length; i++) {
        if (datas[i] - datas[i - n] <= DIAS_JANELA * DIA) {
            const fim = datas[i] + DIAS_BLOQUEIO * DIA;
            if (ate === null || fim > ate) ate = fim;
        }
    }
    if (ate === null || ate <= agora.getTime()) return null;
    const faltas = datas.filter((t) => t > agora.getTime() - DIAS_JANELA * DIA).length;
    return { ate: new Date(ate), faltas };
}

module.exports = { calcularRestricao, DIAS_CONSULTA };
