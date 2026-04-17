// src/server.js
require('dotenv').config();
console.log("URL DO BANCO:", process.env.DATABASE_URL);
const app    = require('./app');
const prisma = require('./config/bancoDeDados');

const PORTA = process.env.PORT || 3000;

async function iniciarServidor() {
    try {
        await prisma.$connect();
        console.log('✅ Conexão com o banco de dados estabelecida via Prisma!');

        const servidor = app.listen(PORTA, () => {
            console.log(`🚀 Servidor MoniPro rodando na porta ${PORTA}`);
        });

        // Graceful Shutdown
        process.on('SIGINT', async () => {
            console.log('\n⚠️  Encerrando o servidor...');
            await prisma.$disconnect();
            servidor.close(() => {
                console.log('🛑 Servidor encerrado.');
                process.exit(0);
            });
        });

    } catch (erro) {
        console.error('❌ Falha crítica ao conectar no banco de dados:', erro);
        await prisma.$disconnect();
        process.exit(1);
    }
}

iniciarServidor();
