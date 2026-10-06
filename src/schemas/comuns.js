// src/schemas/comuns.js
// Tarefa 9: blocos reutilizados pelos schemas de entrada (zod).
const { z } = require('zod');

// Maior valor de uma coluna Int do Postgres — evita erro do banco em vez de 400
const INT_MAXIMO = 2147483647;

/**
 * Texto obrigatório, com trim. Distingue "ausente" de "tipo errado".
 * @param {string} obrigatorio - mensagem para campo ausente/vazio
 * @param {number} maximo - tamanho máximo após o trim
 */
function textoObrigatorio(obrigatorio, maximo) {
    return z
        .string({ error: (iss) => (iss.input === undefined ? obrigatorio : 'Deve ser um texto.') })
        .trim()
        .min(1, obrigatorio)
        .max(maximo, `Deve ter no máximo ${maximo} caracteres.`);
}

/**
 * Inteiro positivo. Aceita número ou string numérica (ex.: "12"), porque
 * formulários e query strings costumam mandar números como texto.
 * @param {{ obrigatorio: string, invalido: string }} mensagens
 */
function inteiroPositivo({ obrigatorio, invalido }) {
    return z.preprocess(
        (valor) => (typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor),
        z
            .number({ error: (iss) => (iss.input === undefined ? obrigatorio : invalido) })
            .int(invalido)
            .positive(invalido)
            .max(INT_MAXIMO, invalido)
    );
}

/**
 * Data/hora em ISO 8601 (ex.: 2026-09-10T14:00:00.000Z), formato que o
 * frontend envia via Date#toISOString().
 */
function dataHoraIso({ obrigatorio, invalido }) {
    return z.iso.datetime({
        offset: true,
        error: (iss) => (iss.input === undefined ? obrigatorio : invalido)
    });
}

module.exports = { textoObrigatorio, inteiroPositivo, dataHoraIso, INT_MAXIMO };
