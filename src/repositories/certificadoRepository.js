// src/repositories/certificadoRepository.js
// Certificados (RF-005): leitura das vagas que entram na declaração de horas.

const prisma = require('../config/bancoDeDados');

class CertificadoRepository {
    /**
     * Vagas do monitor que começaram no período (e até agora), menos as canceladas, com quantas
     * inscrições tiveram a presença confirmada pelos dois lados.
     */
    async buscarVagasDoPeriodo(idMonitor, { inicio, fim }, agora, db = prisma) {
        const vagas = await db.monitoria.findMany({
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
    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }
    // Trava a linha do usuário: duas emissões ao mesmo tempo para a mesma pessoa viram uma fila
    async bloquearUsuario(idUsuario, db) {
        const linhas = await db.$queryRaw`
            SELECT "id", "nome_completo" FROM "usuarios" WHERE "id" = ${idUsuario} FOR UPDATE
        `;
        return linhas[0] || null;
    }
    // A válida anterior do mesmo período vira "substituida" (D-C4)
    async substituirValidos(idUsuario, periodo, db) {
        const { count } = await db.certificado.updateMany({
            where: { id_usuario: idUsuario, periodo, situacao: 'valido' },
            data: { situacao: 'substituido' }
        });
        return count;
    }
    async criar(dados, db) {
        return await db.certificado.create({ data: dados });
    }
    async listarDoUsuario(idUsuario) {
        return await prisma.certificado.findMany({
            where: { id_usuario: idUsuario },
            orderBy: [{ emitido_em: 'desc' }, { id: 'desc' }],
            select: {
                codigo: true,
                periodo: true,
                carga_minutos: true,
                situacao: true,
                emitido_em: true,
                assinado_em: true
            }
        });
    }
    async buscarPorCodigo(codigo) {
        return await prisma.certificado.findUnique({ where: { codigo } });
    }
    // Só muda se ainda não estiver revogada: duas revogações ao mesmo tempo gravam uma só
    async revogar(id, motivo, quando, db = prisma) {
        const { count } = await db.certificado.updateMany({
            where: { id, situacao: { not: 'revogado' } },
            data: { situacao: 'revogado', revogado_em: quando, motivo_revogacao: motivo }
        });
        return count;
    }
}

module.exports = new CertificadoRepository();
