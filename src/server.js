// src/server.js
require('./config/env');
const app = require('./app');
const prisma = require('./config/bancoDeDados');
const { avisosEmail } = require('./config/email');
const notificacaoService = require('./services/notificacaoService');

const PORTA = process.env.PORT || 3000;

let pararNotificacoes = () => {};

async function iniciarServidor() {
    try {
        await prisma.$connect();
        console.log('✅ Conexão com o banco de dados estabelecida via Prisma!');

        const servidor = app.listen(PORTA, () => {
            console.log(`🚀 Servidor MoniPro rodando na porta ${PORTA}`);
            avisosEmail().forEach((aviso) => console.warn(`⚠️  E-mail: ${aviso}`));
            // Plano 3: fila de e-mails de aviso e lembretes, a cada minuto
            pararNotificacoes = notificacaoService.iniciar();
        });

        // Graceful Shutdown
        process.on('SIGINT', async () => {
            console.log('\n⚠️  Encerrando o servidor...');
            pararNotificacoes();
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
