// src/repositories/avaliacaoRepository.js
// Plano 6: avaliações das monitorias.

const prisma = require('../config/bancoDeDados');

class AvaliacaoRepository {
    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }

    async existeParaInscricao(idAgendamento, db = prisma) {
        return Boolean(
            await db.avaliacao.findUnique({
                where: { id_agendamento: idAgendamento },
                select: { id: true }
            })
        );
    }

    async criar(dados, db) {
        return await db.avaliacao.create({ data: dados, select: { nota: true, criado_em: true } });
    }

    /** As não ocultas do monitor, da mais nova para a mais antiga (só o que o resumo usa). */
    async visiveisDoMonitor(idMonitor) {
        return await prisma.avaliacao.findMany({
            where: { id_monitor: idMonitor, oculto_em: null },
            orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
            select: { nota: true, comentario: true, criado_em: true }
        });
    }

    /** Para a coordenação: as com comentário criadas no período, sem dado do aluno. */
    async comComentarioNoPeriodo(inicio, ate) {
        return await prisma.avaliacao.findMany({
            where: { comentario: { not: null }, criado_em: { gte: inicio, lt: ate } },
            orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
            select: {
                id: true,
                nota: true,
                comentario: true,
                criado_em: true,
                oculto_em: true,
                agendamento: {
                    select: {
                        monitoria: {
                            select: {
                                monitor: { select: { nome_completo: true } },
                                disciplina: { select: { nome: true } }
                            }
                        }
                    }
                }
            }
        });
    }

    /** Média e total das visíveis de cada monitor no período (uma consulta). */
    async mediasPorMonitor(inicio, ate) {
        const linhas = await prisma.avaliacao.groupBy({
            by: ['id_monitor'],
            where: { oculto_em: null, criado_em: { gte: inicio, lt: ate } },
            _avg: { nota: true },
            _count: { _all: true }
        });
        return new Map(
            linhas.map((l) => [
                l.id_monitor,
                { soma: l._avg.nota * l._count._all, total: l._count._all }
            ])
        );
    }

    async buscar(id, db = prisma) {
        return await db.avaliacao.findUnique({
            where: { id },
            select: { id: true, id_agendamento: true, oculto_em: true }
        });
    }

    /** Oculta ou mostra de novo, só se ainda estiver no estado esperado. */
    async moderar(id, { ocultar, idModerador, quando }, db) {
        const { count } = await db.avaliacao.updateMany({
            where: { id, oculto_em: ocultar ? null : { not: null } },
            data: ocultar
                ? { oculto_em: quando, id_moderador: idModerador }
                : { oculto_em: null, id_moderador: idModerador }
        });
        return count;
    }
}

module.exports = new AvaliacaoRepository();
