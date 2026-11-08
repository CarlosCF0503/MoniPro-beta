// src/config/bancoDeDados.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();
const { opcoesSsl } = require('./sslBanco');

// SSL validado contra a CA própria (DB_CA_CERT) em produção e homologação; ver sslBanco.js.
// Nunca desativar a verificação (NODE_TLS_REJECT_UNAUTHORIZED / rejectUnauthorized: false).
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: opcoesSsl()
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
