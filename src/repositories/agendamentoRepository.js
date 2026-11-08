// src/repositories/agendamentoRepository.js

const prisma = require('../config/bancoDeDados');
const { PONTOS_MONITOR, PONTOS_ALUNO } = require('../utils/regrasConclusao');

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
            SELECT "capacidade", "status"::text AS "status", "horario"
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

    // P2 (R4): trava a inscrição (SELECT ... FOR UPDATE) até o fim da transação e traz os dados
    // da vaga. Assim, aluno e monitor confirmando ao mesmo tempo são atendidos um depois do
    // outro, e só o segundo conclui e credita os pontos.
    async bloquearParaPresenca(id, db = prisma) {
        const linhas = await db.$queryRaw`
            SELECT a."id", a."id_aluno", a."status"::text AS "status",
                   a."presenca_aluno_em", a."presenca_monitor_em",
                   m."id_monitor", m."horario", m."status"::text AS "status_vaga"
            FROM "agendamentos" a
            JOIN "monitorias" m ON m."id" = a."id_monitoria"
            WHERE a."id" = ${parseInt(id)}
            FOR UPDATE OF a
        `;
        return linhas[0] || null;
    }

    // Grava a confirmação de um dos lados; com `concluir`, marca o agendamento como concluído.
    async registrarPresenca(id, campo, quando, concluir, db = prisma) {
        return await db.agendamento.update({
            where: { id: parseInt(id) },
            data: { [campo]: quando, ...(concluir ? { status: 'concluido' } : {}) }
        });
    }

    // D1: +10 para o monitor e +2 para o aluno quando a presença é confirmada pelos dois
    async creditarPontos(idMonitor, idAluno, db = prisma) {
        await db.usuario.update({
            where: { id: idMonitor },
            data: { pontos: { increment: PONTOS_MONITOR } }
        });
        await db.usuario.update({
            where: { id: idAluno },
            data: { pontos: { increment: PONTOS_ALUNO } }
        });
    }
}

module.exports = new AgendamentoRepository();
