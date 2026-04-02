// src/config/bancoDeDados.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg }    = require('@prisma/adapter-pg');
const { Pool }        = require('pg');
require('dotenv').config();

// Detecta automaticamente se está em produção (Aiven/Render) ou local
const isProducao = process.env.DATABASE_URL?.includes('aivencloud.com') ||
    process.env.NODE_ENV === 'production';

if (isProducao) {
    // Produção (Aiven): aceita certificado SSL
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProducao ? { rejectUnauthorized: false } : false
});

const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

module.exports = prisma;