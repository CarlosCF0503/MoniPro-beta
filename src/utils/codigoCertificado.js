// src/utils/codigoCertificado.js
// Código de verificação da declaração: 128 bits aleatórios em base32 (26 caracteres, sem
// 0/1/I/L/O/U para não confundir quem digita). Nunca derivado do id: não dá para adivinhar
// nem percorrer.

const crypto = require('node:crypto');

const ALFABETO = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // 30 símbolos // pragma: allowlist secret
const TAMANHO = 26; // 30^26 > 2^127
const FORMATO = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

function gerarCodigo() {
    // Rejeição para não enviesar: só usa bytes < 240 (240 = 8 * 30)
    let codigo = '';
    while (codigo.length < TAMANHO) {
        for (const byte of crypto.randomBytes(32)) {
            if (byte < 240 && codigo.length < TAMANHO) codigo += ALFABETO[byte % 30];
        }
    }
    return codigo;
}

/** Aceita o código com hífens ou espaços e em minúsculas; devolve null se não tiver o formato. */
function normalizarCodigo(texto) {
    const limpo = String(texto || '')
        .toUpperCase()
        .replace(/[\s-]/g, '');
    return FORMATO.test(limpo) ? limpo : null;
}

module.exports = { gerarCodigo, normalizarCodigo, TAMANHO };
