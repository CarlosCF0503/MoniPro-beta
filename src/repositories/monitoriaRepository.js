// src/repositories/monitoriaRepository.js
const { Prisma } = require('@prisma/client');
const prisma = require('../config/bancoDeDados');
const { OCUPA_LUGAR, NA_FILA } = require('../utils/statusInscricao');
const { FUSO_TURNOS, TURNOS } = require('../config/turnos');

// Campos gravados ao criar uma vaga (avulsa ou de uma série)
function dadosDaVaga(dados) {
    return {
        id_disciplina: Number(dados.id_disciplina),
        id_monitor: dados.id_monitor,
        local: dados.local,
        descricao: dados.descricao,
        status: dados.status || 'ativa',
        horario: dados.horario,
        // Plano 11: presencial ou on-line (com o link da sala)
        modalidade: dados.modalidade || 'presencial',
        link: dados.modalidade === 'online' ? dados.link : null,
        // Plano 9: série semanal
        ...(dados.id_serie && { id_serie: dados.id_serie }),
        // Omitido => o banco aplica o default (1)
        ...(dados.capacidade !== undefined && { capacidade: dados.capacidade })
    };
}

const temFiltro = (f = {}) => Boolean(f.periodo || f.monitor || f.livres);

class MonitoriaRepository {
    async criar(dados) {
        return await prisma.monitoria.create({ data: dadosDaVaga(dados) });
    }

    // Plano 9: as vagas de uma série, numa transação só. Devolve as linhas criadas.
    async criarSerie(dados, horarios, idSerie) {
        return await prisma.$transaction((tx) =>
            tx.monitoria.createManyAndReturn({
                data: horarios.map((horario) =>
                    dadosDaVaga({ ...dados, horario, id_serie: idSerie })
                )
            })
        );
    }

    // Plano 9: horários (entre os informados) em que o monitor já tem vaga ativa
    async horariosOcupadosDoMonitor(idMonitor, horarios) {
        const linhas = await prisma.monitoria.findMany({
            where: { id_monitor: idMonitor, status: 'ativa', horario: { in: horarios } },
            select: { horario: true }
        });
        return linhas.map((l) => l.horario);
    }

    // Plano 9: vagas ativas da série a partir de um horário (inclusive), em ordem
    async buscarDaSerieAPartirDe(idSerie, horario) {
        return await prisma.monitoria.findMany({
            where: { id_serie: idSerie, status: 'ativa', horario: { gte: horario } },
            select: { id: true, horario: true },
            orderBy: { horario: 'asc' }
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

    // Plano 13 (RF-017): ids das vagas ativas da disciplina que passam nos filtros, já
    // paginados. O turno (hora no fuso do campus) e "com lugar livre" (inscritos que ocupam
    // lugar < capacidade) não cabem no where do Prisma, por isso a consulta é SQL.
    async buscarIdsFiltrados(idDisciplina, filtros, { skip = 0, take = 100 } = {}) {
        const condicoes = [
            Prisma.sql`m."id_disciplina" = ${idDisciplina}`,
            Prisma.sql`m."status" = 'ativa'`
        ];
        if (filtros.monitor) condicoes.push(Prisma.sql`m."id_monitor" = ${filtros.monitor}`);
        if (filtros.periodo) {
            const [de, ate] = TURNOS[filtros.periodo];
            const hora = Prisma.sql`EXTRACT(HOUR FROM (m."horario" AT TIME ZONE 'UTC') AT TIME ZONE ${FUSO_TURNOS})`;
            condicoes.push(Prisma.sql`${hora} >= ${de} AND ${hora} < ${ate}`);
        }
        if (filtros.livres) {
            // Mesmo critério de OCUPA_LUGAR: nem cancelada nem na lista de espera
            condicoes.push(Prisma.sql`(
                SELECT count(*) FROM "agendamentos" a
                WHERE a."id_monitoria" = m."id"
                  AND a."status"::text NOT IN ('cancelado', 'em_espera')
            ) < m."capacidade"`);
        }
        const where = Prisma.join(condicoes, ' AND ');
        const [linhas, contagem] = await Promise.all([
            prisma.$queryRaw`
                SELECT m."id" FROM "monitorias" m
                WHERE ${where}
                ORDER BY m."horario" ASC, m."id" ASC
                OFFSET ${skip} LIMIT ${take}
            `,
            prisma.$queryRaw`SELECT count(*)::int AS "total" FROM "monitorias" m WHERE ${where}`
        ]);
        return { ids: linhas.map((l) => l.id), total: contagem[0].total };
    }

    async buscarPorDisciplina(idDisciplina, { skip, take } = {}, filtros = {}) {
        let where = {
            id_disciplina: idDisciplina,
            status: 'ativa'
        };
        let total = null;
        if (temFiltro(filtros)) {
            const filtrado = await this.buscarIdsFiltrados(idDisciplina, filtros, { skip, take });
            if (!filtrado.ids.length) return { dados: [], total: filtrado.total };
            where = { id: { in: filtrado.ids } };
            total = filtrado.total;
            skip = undefined;
            take = undefined;
        }

        const [dados, contados] = await Promise.all([
            prisma.monitoria.findMany({
                where,
                // Plano 11: o link da sala é só de quem se inscreveu, nunca da listagem
                omit: { link: true },
                include: {
                    monitor: { select: { nome_completo: true } },
                    // Inscrições que ocupam lugar (nem canceladas nem na lista de espera)
                    _count: { select: { inscricoes: { where: OCUPA_LUGAR } } }
                },
                orderBy: [{ horario: 'asc' }, { id: 'asc' }],
                skip,
                take
            }),
            total === null ? prisma.monitoria.count({ where }) : total
        ]);

        return { dados, total: contados };
    }

    async buscarAgendamentos(monitorId, { skip, take } = {}) {
        // A fila (plano 8) não aparece aqui: o monitor só vê o tamanho dela, em cada vaga
        const where = {
            monitoria: { id_monitor: monitorId },
            status: { not: 'em_espera' }
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
            SELECT "id", "id_monitor", "horario", "local", "status"::text AS "status",
                   "modalidade"::text AS "modalidade", "link"
            FROM "monitorias"
            WHERE "id" = ${parseInt(id)}
            FOR UPDATE
        `;
        return linhas[0] || null;
    }

    // Inscrições que ocupam lugar, como em buscarPorDisciplina
    async contarInscritos(idMonitoria, db = prisma) {
        return await db.agendamento.count({
            where: { id_monitoria: parseInt(idMonitoria), ...OCUPA_LUGAR }
        });
    }

    // Plano 8: tamanho da lista de espera de cada vaga, { id_monitoria: quantos }
    async contarFilas(idsMonitorias, db = prisma) {
        if (!idsMonitorias.length) return {};
        const grupos = await db.agendamento.groupBy({
            by: ['id_monitoria'],
            where: { id_monitoria: { in: idsMonitorias }, ...NA_FILA },
            _count: { _all: true }
        });
        return Object.fromEntries(grupos.map((g) => [g.id_monitoria, g._count._all]));
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
        // Inscritos e quem está na lista de espera (plano 8): a fila também segue o novo horário
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
                    // Inscrições que ocupam lugar, como em buscarPorDisciplina
                    _count: { select: { inscricoes: { where: OCUPA_LUGAR } } }
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
