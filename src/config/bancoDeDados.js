// src/config/bancoDeDados.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg }     = require('@prisma/adapter-pg');
const { Pool }         = require('pg');
const fs               = require('fs');
require('dotenv').config();

// Detecta se está em produção (Aiven/Render) ou local
const isProducao = process.env.DATABASE_URL?.includes('aivencloud.com') ||
    process.env.NODE_ENV === 'production';

function getCaCertificate(){
    if (process.env.DB_CA_CERT) {
        //resolve o problema de quebras de linha que o .env geralmente causa
        return process.env.DB_CA_CERT.replace(/\\n/g, '\n');
    }

    if (process.env.DB_CA_CERT_PATH) {
        try {
            if (fs.existsSync(process.env.DB_CA_CERT_PATH)) {
                return fs.readFileSync(process.env.DB_CA_CERT_PATH, 'utf-8');
            }
        } catch(error) {
            console.error('Erro ao ler o arquivo no caminho DB_CA_CERT_PATH', error.message);
            
        }
    }

    throw new Error ("Certificado SSL obrigatório para a Aiven não foi configurado. Verifique DB_CA_CERT ou DB_CA_CERT_PATH.");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProducao ? { 
            rejectUnauthorized: true,
            ca: getCaCertificate() 
          } : false
});

const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

module.exports = prisma;