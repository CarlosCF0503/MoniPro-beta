// src/controllers/saudeController.js
// Tarefa 17: health check para monitoramento externo. O backend roda em VPS próprio, sem o
// monitoramento automático de Render/Vercel, então um serviço externo (ex.: UptimeRobot)
// consulta GET /saude periodicamente.
const prisma = require('../config/bancoDeDados');
const logger = require('../utils/logger');

// Se o banco não responder dentro deste prazo, a API é considerada indisponível
const TEMPO_LIMITE_BANCO_MS = 3000;

function comTempoLimite(promessa, ms) {
    let temporizador;
    const limite = new Promise((_, rejeitar) => {
        temporizador = setTimeout(() => rejeitar(new Error('tempo limite do banco')), ms);
    });
    return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
}

exports.verificar = async (req, res) => {
    const inicio = Date.now();
    try {
        await comTempoLimite(prisma.$queryRaw`SELECT 1`, TEMPO_LIMITE_BANCO_MS);
        res.status(200).json({
            status: 'ok',
            banco: 'ok',
            latencia_banco_ms: Date.now() - inicio,
            uptime_s: Math.round(process.uptime())
        });
    } catch (erro) {
        // O detalhe do erro vai só para o log; a resposta pública não expõe nada interno
        logger.error({ err: erro }, 'Health check falhou: banco indisponível');
        res.status(503).json({ status: 'erro', banco: 'indisponivel' });
    }
};

// Exportado para teste
exports.comTempoLimite = comTempoLimite;
