// src/repositories/certificadoRepository.js
// Certificados (RF-005): leitura das vagas que entram na declaração de horas.

const prisma = require('../config/bancoDeDados');

class CertificadoRepository {
    /**
     * Vagas do monitor que começaram no período (e até agora), menos as canceladas, com quantas
     * inscrições tiveram a presença confirmada pelos dois lados.
     */
    async buscarVagasDoPeriodo(idMonitor, { inicio, fim }, agora) {
        const vagas = await prisma.monitoria.findMany({
            where: {
                id_monitor: idMonitor,
                status: { not: 'cancelada' },
                horario: { gte: inicio, lt: fim < agora ? fim : agora }
            },
            select: {
                horario: true,
                data_fim: true,
                status: true,
                disciplina: { select: { nome: true } },
                _count: { select: { inscricoes: { where: { status: 'concluido' } } } }
            },
            orderBy: { horario: 'asc' }
        });
        return vagas.map((v) => ({
            horario: v.horario,
            data_fim: v.data_fim,
            status: v.status,
            disciplina: v.disciplina.nome,
            confirmadas: v._count.inscricoes
        }));
    }
}

module.exports = new CertificadoRepository();
