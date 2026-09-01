// src/config/env.js
require('dotenv').config();

const obrigatorias = ['DATABASE_URL', 'JWT_SECRET'];

const faltando = obrigatorias.filter((chave) => !process.env[chave]);

if (faltando.length > 0) {
    console.error(`❌ Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}`);
    console.error('   Verifique se o arquivo .env existe e contém essas variáveis.');
    process.exit(1);
}

module.exports = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET
};
