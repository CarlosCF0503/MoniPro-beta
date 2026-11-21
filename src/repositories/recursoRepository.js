// src/repositories/recursoRepository.js
// Plano 7: pedidos de revisão de falta (recursos) com comprovante.

const prisma = require('../config/bancoDeDados');

const SEM_ARQUIVO = {
    id: true,
    id_agendamento: true,
    id_aluno: true,
    justificativa: true,
    arquivo_nome: true,
    arquivo_tipo: true,
    arquivo_tamanho: true,
    status: true,
    motivo_decisao: true,
    criado_em: true,
    decidido_em: true
};

class RecursoRepository {
    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }

    /** A inscrição do aluno com a falta e o pedido que já existir (trava a linha). */
    async bloquearInscricao(id, db) {
        const linhas = await db.$queryRaw`
            SELECT a."id", a."id_aluno", a."ausente_em", m."horario"
            FROM "agendamentos" a
            JOIN "monitorias" m ON m."id" = a."id_monitoria"
            WHERE a."id" = ${parseInt(id)}
            FOR UPDATE OF a
        `;
        return linhas[0] || null;
    }

    async buscarPorAgendamento(idAgendamento, db = prisma) {
        return await db.recursoFalta.findUnique({
            where: { id_agendamento: idAgendamento },
            select: { id: true }
        });
    }

    async criar(dados, db) {
        return await db.recursoFalta.create({
            data: dados,
            select: { status: true, criado_em: true, motivo_decisao: true }
        });
    }

    /** Pendentes, do mais antigo para o mais novo, com aluno, sessão e dados do arquivo (sem os bytes). */
    async listarPendentes() {
        const linhas = await prisma.recursoFalta.findMany({
            where: { status: 'pendente' },
            orderBy: [{ criado_em: 'asc' }, { id: 'asc' }],
            select: {
                ...SEM_ARQUIVO,
                agendamento: {
                    select: {
                        aluno: { select: { nome_completo: true } },
                        monitoria: {
                            select: {
                                horario: true,
                                monitor: { select: { nome_completo: true } },
                                disciplina: { select: { nome: true } }
                            }
                        }
                    }
                }
            }
        });
        return linhas;
    }

    async buscar(id, db = prisma) {
        return await db.recursoFalta.findUnique({ where: { id }, select: SEM_ARQUIVO });
    }

    async buscarArquivo(id) {
        return await prisma.recursoFalta.findUnique({
            where: { id },
            select: { arquivo: true, arquivo_nome: true, arquivo_tipo: true }
        });
    }

    /** Decide só se ainda estiver pendente (duas decisões ao mesmo tempo gravam uma). */
    async decidir(id, { status, motivo, idDecisor, quando }, db) {
        const { count } = await db.recursoFalta.updateMany({
            where: { id, status: 'pendente' },
            data: {
                status,
                motivo_decisao: motivo || null,
                id_decisor: idDecisor,
                decidido_em: quando
            }
        });
        return count;
    }

    // Retenção (180 dias a partir do envio) e exclusão da conta do aluno
    async contarAntigos(limite) {
        return await prisma.recursoFalta.count({ where: { criado_em: { lt: limite } } });
    }
    async apagarAntigos(limite) {
        const { count } = await prisma.recursoFalta.deleteMany({
            where: { criado_em: { lt: limite } }
        });
        return count;
    }
    async apagarDoAluno(idAluno, db = prisma) {
        const { count } = await db.recursoFalta.deleteMany({ where: { id_aluno: idAluno } });
        return count;
    }
}

module.exports = new RecursoRepository();
