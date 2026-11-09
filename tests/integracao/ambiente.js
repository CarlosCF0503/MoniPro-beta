// R1: variáveis de cada arquivo de teste de integração. O DATABASE_URL vem sempre de
// DATABASE_URL_INTEGRACAO (validada), nunca de um .env, que pode apontar para outro banco.
const { urlBancoIntegracao } = require('./bancoIntegracao');

process.env.DATABASE_URL = urlBancoIntegracao();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-dos-testes-de-integracao';
process.env.ALLOWED_ORIGINS = 'https://moni-pro.app.br';
// Silencia o log da aplicação (pino) durante os testes
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
