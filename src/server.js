// src/server.js
require('./config/env');
const app = require('./app');
const prisma = require('./config/bancoDeDados');
const { avisosEmail } = require('./config/email');
const notificacaoService = require('./services/notificacaoService');
const logger = require('./utils/logger');

const PORTA = process.env.PORT || 3000;

let pararNotificacoes = () => {};

async function iniciarServidor() {
    try {
        await prisma.$connect();
        logger.info('Conexão com o banco de dados estabelecida');

        const servidor = app.listen(PORTA, () => {
            logger.info({ porta: Number(PORTA) }, 'Servidor MoniPro no ar');
            avisosEmail().forEach((aviso) => logger.warn(`E-mail: ${aviso}`));
            // Plano 3: fila de e-mails de aviso e lembretes, a cada minuto
            pararNotificacoes = notificacaoService.iniciar();
        });

        // Encerramento gracioso. O "docker stop" (e a troca de containers no deploy) manda
        // SIGTERM; o Ctrl+C no terminal manda SIGINT. Sem tratar o SIGTERM, o Node rodando como
        // processo 1 do container ignorava o sinal e só morria pelo SIGKILL, 10 s depois.
        const encerrar = async (sinal) => {
            logger.info({ sinal }, 'Encerrando o servidor');
            pararNotificacoes();
            await prisma.$disconnect();
            servidor.close(() => {
                logger.info('Servidor encerrado');
                process.exit(0);
            });
        };
        process.once('SIGINT', encerrar);
        process.once('SIGTERM', encerrar);
    } catch (erro) {
        logger.fatal({ err: erro }, 'Falha crítica ao conectar no banco de dados');
        await prisma.$disconnect();
        process.exit(1);
    }
}

iniciarServidor();
