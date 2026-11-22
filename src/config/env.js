// src/config/env.js
require('dotenv').config();

const obrigatorias = ['DATABASE_URL', 'JWT_SECRET'];

const faltando = obrigatorias.filter((chave) => !process.env[chave]);

if (faltando.length > 0) {
    console.error(`❌ Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}`);
    console.error('   Verifique se o arquivo .env existe e contém essas variáveis.');
    process.exit(1);
}

// Um segredo curto deixa o JWT (HS256) sujeito a adivinhação offline. Só avisa, sem derrubar o
// servidor, para não tirar do ar um ambiente que ainda use um segredo antigo: troque por um de
// 32+ caracteres aleatórios (ex.: `openssl rand -base64 48`). Trocar encerra as sessões abertas.
const TAMANHO_MINIMO_SEGREDO = 32;
if (
    process.env.NODE_ENV === 'production' &&
    process.env.JWT_SECRET.length < TAMANHO_MINIMO_SEGREDO
) {
    console.warn(
        `⚠️  JWT_SECRET tem menos de ${TAMANHO_MINIMO_SEGREDO} caracteres. Use um segredo longo e aleatório.`
    );
}

module.exports = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET
};
