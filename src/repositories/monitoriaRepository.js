// src/repositories/monitoriaRepository.js
const prisma = require('../config/bancoDeDados');

class MonitoriaRepository {
    async criar(dados) {
        return await prisma.monitoria.create({
            data: {
                id_disciplina: Number(dados.id_disciplina),
                id_monitor: dados.id_monitor,
                local: dados.local,
                descricao: dados.descricao,
                status: dados.status || 'ativa',
                horario: dados.horario,
                // Omitido => o banco aplica o default (1)
                ...(dados.capacidade !== undefined && { capacidade: dados.capacidade })
            }
        });
    }

    // Vaga ativa do mesmo monitor que começa exatamente no mesmo horário (ou null)
    async buscarAtivaDoMonitorNoHorario(idMonitor, horario) {
        return await prisma.monitoria.findFirst({
            where: {
                id_monitor: idMonitor,
                horario: new Date(horario),
                status: 'ativa'
            },
            select: { id: true }
        });
    }

    async buscarPorDisciplina(idDisciplina, { skip, take } = {}) {
        const where = {
            id_disciplina: idDisciplina,
            status: 'ativa'
        };

        const [dados, total] = await Promise.all([
            prisma.monitoria.findMany({
                where,
                include: {
                    monitor: { select: { nome_completo: true } },
                    // Inscrições que ocupam vaga (tudo que não foi cancelado)
                    _count: {
                        select: { inscricoes: { where: { status: { not: 'cancelado' } } } }
                    }
                },
                orderBy: { horario: 'asc' },
                skip,
                take
            }),
            prisma.monitoria.count({ where })
        ]);

        return { dados, total };
    }

    async buscarAgendamentos(monitorId, { skip, take } = {}) {
        const where = {
            monitoria: { id_monitor: monitorId }
        };

        const [dados, total] = await Promise.all([
            prisma.agendamento.findMany({
                where,
                include: {
                    aluno: {
                        select: { nome_completo: true, email: true, matricula: true }
                    },
                    monitoria: {
                        select: {
                            local: true,
                            horario: true,
                            disciplina: { select: { nome: true } }
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
        return await prisma.monitoria.findUnique({
            where: { id: parseInt(id) }
        });
    }

    async cancelar(id, db = prisma) {
        return await db.monitoria.update({
            where: { id: parseInt(id) },
            data: { status: 'cancelada' }
        });
    }
    // Finaliza a vaga do próprio monitor. O updateMany condicional (dono + status ainda
    // ativa/pendente) impede finalizar duas vezes ou finalizar uma vaga cancelada, mesmo com
    // requisições simultâneas. Retorna null se nenhuma linha foi alterada.
    async finalizar(id, idMonitor, dataFim) {
        const { count } = await prisma.monitoria.updateMany({
            where: {
                id: parseInt(id),
                id_monitor: idMonitor,
                status: { in: ['ativa', 'pendente'] }
            },
            data: { status: 'realizada', data_fim: dataFim }
        });
        if (count === 0) return null;

        return await prisma.monitoria.findUnique({ where: { id: parseInt(id) } });
    }

    // --- Editar vaga (RF-009) ---

    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }

    // Trava a linha da vaga (SELECT ... FOR UPDATE) até o fim da transação. A inscrição
    // (agendamentoService.criar) trava a mesma linha, então editar os lugares e se inscrever ao
    // mesmo tempo acontecem um depois do outro, e a contagem de inscritos não fica velha.
    async bloquearParaEdicao(id, db = prisma) {
        const linhas = await db.$queryRaw`
            SELECT "id", "id_monitor", "horario", "local", "status"::text AS "status"
            FROM "monitorias"
            WHERE "id" = ${parseInt(id)}
            FOR UPDATE
        `;
        return linhas[0] || null;
    }

    // Inscrições que ocupam vaga (tudo que não foi cancelado), como em buscarPorDisciplina
    async contarInscritos(idMonitoria, db = prisma) {
        return await db.agendamento.count({
            where: { id_monitoria: parseInt(idMonitoria), status: { not: 'cancelado' } }
        });
    }

    // Outra vaga ativa do mesmo monitor no horário exato (a própria vaga fica de fora)
    async buscarOutraAtivaNoHorario(idMonitor, horario, idIgnorar, db = prisma) {
        return await db.monitoria.findFirst({
            where: {
                id_monitor: idMonitor,
                horario: new Date(horario),
                status: 'ativa',
                id: { not: parseInt(idIgnorar) }
            },
            select: { id: true }
        });
    }

    async atualizar(id, dados, db = prisma) {
        return await db.monitoria.update({ where: { id: parseInt(id) }, data: dados });
    }

    // Vaga mudou de dia, horário ou local: as inscrições ativas passam a poder ser canceladas
    // sem a antecedência de 24h. Com novo horário, data_hora acompanha a vaga (Tarefa 31).
    // `antes` é a vaga antes desta edição ({ horario, local }); o anterior só é gravado onde
    // ainda está vazio, para guardar como a vaga era quando o aluno se inscreveu, mesmo depois
    // de várias edições.
    async liberarInscricoes(idMonitoria, quando, { novoHorario, mudouLocal, antes }, db = prisma) {
        const ativas = { id_monitoria: parseInt(idMonitoria), status: { not: 'cancelado' } };
        const { count } = await db.agendamento.updateMany({
            where: ativas,
            data: {
                liberado_cancelar_em: quando,
                ...(novoHorario ? { data_hora: novoHorario } : {})
            }
        });
        if (novoHorario) {
            await db.agendamento.updateMany({
                where: { ...ativas, horario_anterior: null },
                data: { horario_anterior: antes.horario }
            });
        }
        if (mudouLocal) {
            await db.agendamento.updateMany({
                where: { ...ativas, local_anterior: null },
                data: { local_anterior: antes.local }
            });
        }
        return count;
    }

    async buscarPorMonitor(idMonitor, { skip, take } = {}) {
        const where = { id_monitor: idMonitor };

        const [dados, total] = await Promise.all([
            prisma.monitoria.findMany({
                where,
                include: {
                    disciplina: { select: { nome: true } },
                    // Inscrições que ocupam vaga (tudo que não foi cancelado), como em buscarPorDisciplina
                    _count: {
                        select: { inscricoes: { where: { status: { not: 'cancelado' } } } }
                    }
                },
                orderBy: { horario: 'desc' },
                skip,
                take
            }),
            prisma.monitoria.count({ where })
        ]);

        return { dados, total };
    }
}

module.exports = new MonitoriaRepository();
