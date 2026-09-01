// src/config/bancoDeDados.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

// Detecta automaticamente se está em produção (Aiven/Render) ou local
const isProducao =
    process.env.DATABASE_URL?.includes('aivencloud.com') || process.env.NODE_ENV === 'production';

// Produção (Aiven): valida o certificado SSL contra a CA fornecida via env,
// em vez de desativar a verificação (NODE_TLS_REJECT_UNAUTHORIZED / rejectUnauthorized: false).
if (isProducao && !process.env.DB_CA_CERT) {
    throw new Error(
        'DB_CA_CERT não definido: obrigatório para validar a conexão SSL com o Postgres em produção.'
    );
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProducao
        ? { rejectUnauthorized: true, ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n') }
        : false
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
