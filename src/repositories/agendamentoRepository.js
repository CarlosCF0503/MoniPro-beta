// src/repositories/agendamentoRepository.js

const prisma = require('../config/bancoDeDados');

class AgendamentoRepository {
    // Executa `fn` dentro de uma transação interativa. `fn` recebe o cliente da transação (tx),
    // que deve ser repassado aos métodos abaixo via parâmetro `db`.
    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }

    // Trava a linha da monitoria (SELECT ... FOR UPDATE) até o fim da transação, serializando
    // inscrições concorrentes na mesma vaga. Sem isso, duas requisições simultâneas poderiam
    // contar a mesma ocupação e ultrapassar a capacidade.
    async bloquearMonitoria(idMonitoria, db = prisma) {
        const linhas = await db.$queryRaw`
            SELECT "capacidade", "status"::text AS "status"
            FROM "monitorias"
            WHERE "id" = ${parseInt(idMonitoria)}
            FOR UPDATE
        `;
        return linhas[0] || null;
    }

    // Inscrições que ocupam vaga: tudo que não foi cancelado.
    async contarOcupadas(idMonitoria, db = prisma) {
        return await db.agendamento.count({
            where: {
                id_monitoria: parseInt(idMonitoria),
                status: { not: 'cancelado' }
            }
        });
    }

    async criar(dados, db = prisma) {
        return await db.agendamento.create({ data: dados });
    }

    async buscarPorAluno(idAluno, { skip, take } = {}) {
        const where = { id_aluno: parseInt(idAluno) };

        const [dados, total] = await Promise.all([
            prisma.agendamento.findMany({
                where,

                include: {
                    monitoria: {
                        include: {
                            disciplina: true,

                            monitor: { select: { nome_completo: true } }
                        }
                    }
                },

                orderBy: { data_hora: 'desc' },

                skip,

                take
            }),

            prisma.agendamento.count({ where })
        ]);

        return { dados, total };
    }

    async buscarPorId(id) {
        return await prisma.agendamento.findUnique({
            where: { id: parseInt(id) }
        });
    }

    async buscarPorAlunoEMonitoria(idAluno, idMonitoria, db = prisma) {
        return await db.agendamento.findFirst({
            where: {
                id_aluno: parseInt(idAluno),

                id_monitoria: parseInt(idMonitoria)
            }
        });
    }

    async deletar(id) {
        return await prisma.agendamento.delete({
            where: { id: parseInt(id) }
        });
    }

    async concluirEIncrementarPontos(idAgendamento, idAluno) {
        return await prisma.$transaction([
            prisma.agendamento.update({
                where: { id: idAgendamento },

                data: { status: 'concluido' }
            }),

            prisma.usuario.update({
                where: { id: idAluno },

                data: { pontos: { increment: 10 } }
            })
        ]);
    }
}

module.exports = new AgendamentoRepository();
