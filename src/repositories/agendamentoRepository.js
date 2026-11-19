// src/repositories/agendamentoRepository.js

const prisma = require('../config/bancoDeDados');
const { OCUPA_LUGAR, NA_FILA } = require('../utils/statusInscricao');

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
            SELECT "id", "capacidade", "status"::text AS "status", "horario"
            FROM "monitorias"
            WHERE "id" = ${parseInt(idMonitoria)}
            FOR UPDATE
        `;
        return linhas[0] || null;
    }

    // Inscrições que ocupam vaga: nem canceladas nem na lista de espera (plano 8)
    async contarOcupadas(idMonitoria, db = prisma) {
        return await db.agendamento.count({
            where: { id_monitoria: parseInt(idMonitoria), ...OCUPA_LUGAR }
        });
    }

    // --- Lista de espera (plano 8) ---

    async contarFila(idMonitoria, db = prisma) {
        return await db.agendamento.count({
            where: { id_monitoria: parseInt(idMonitoria), ...NA_FILA }
        });
    }

    // Os `quantos` primeiros da fila, na ordem de entrada
    async primeirosDaFila(idMonitoria, quantos, db = prisma) {
        return await db.agendamento.findMany({
            where: { id_monitoria: parseInt(idMonitoria), ...NA_FILA },
            orderBy: { id: 'asc' },
            take: quantos,
            select: { id: true, id_aluno: true }
        });
    }

    // Sai da fila e vira inscrição. Com `liberarCancelamento`, pode cancelar até o início
    // (promovido com menos de 24h, decisão de 18/11), como na vaga editada.
    async promover(id, quando, liberarCancelamento, db = prisma) {
        return await db.agendamento.update({
            where: { id },
            data: {
                status: 'pendente',
                promovido_em: quando,
                ...(liberarCancelamento ? { liberado_cancelar_em: quando } : {})
            }
        });
    }

    // Posição na fila (1 = o próximo): quantos da mesma vaga entraram antes, mais um
    async posicaoNaFila(id, idMonitoria, db = prisma) {
        const antes = await db.agendamento.count({
            where: { id_monitoria: parseInt(idMonitoria), ...NA_FILA, id: { lt: parseInt(id) } }
        });
        return antes + 1;
    }

    // Posições de várias inscrições em espera de uma vez (perfil do aluno): { id: posição }
    async posicoesNaFila(inscricoes, db = prisma) {
        const posicoes = {};
        for (const { id, id_monitoria } of inscricoes) {
            posicoes[id] = await this.posicaoNaFila(id, id_monitoria, db);
        }
        return posicoes;
    }

    async criar(dados, db = prisma) {
        return await db.agendamento.create({ data: dados });
    }

    async buscarPorAluno(idAluno, { skip, take } = {}) {
        const where = { id_aluno: parseInt(idAluno) };

        const [linhas, total] = await Promise.all([
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

        // Plano 11: o link da sala on-line só vai para quem tem lugar na vaga. Na lista de
        // espera ou com a inscrição cancelada, o aluno não vê o link.
        const dados = linhas.map((a) =>
            a.monitoria && ['cancelado', 'em_espera'].includes(a.status)
                ? { ...a, monitoria: { ...a.monitoria, link: null } }
                : a
        );
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

    async deletar(id, db = prisma) {
        return await db.agendamento.delete({
            where: { id: parseInt(id) }
        });
    }

    // Plano 8: quem estava na fila de uma vaga que deixou de acontecer sai dela
    async encerrarFila(idMonitoria, db = prisma) {
        const { count } = await db.agendamento.updateMany({
            where: { id_monitoria: parseInt(idMonitoria), ...NA_FILA },
            data: { status: 'cancelado' }
        });
        return count;
    }

    // P2 (R4): trava a inscrição (SELECT ... FOR UPDATE) até o fim da transação e traz os dados
    // da vaga. Assim, aluno e monitor confirmando ao mesmo tempo são atendidos um depois do
    // outro, e só o segundo conclui e credita os pontos.
    async bloquearParaPresenca(id, db = prisma) {
        const linhas = await db.$queryRaw`
            SELECT a."id", a."id_aluno", a."status"::text AS "status",
                   a."presenca_aluno_em", a."presenca_monitor_em", a."ausente_em",
                   m."id_monitor", m."id_disciplina", m."horario", m."status"::text AS "status_vaga"
            FROM "agendamentos" a
            JOIN "monitorias" m ON m."id" = a."id_monitoria"
            WHERE a."id" = ${parseInt(id)}
            FOR UPDATE OF a
        `;
        return linhas[0] || null;
    }

    // Grava a confirmação de um dos lados; com `concluir`, marca o agendamento como concluído.
    // Plano 12: a presença confirmada pelo monitor desfaz uma falta marcada antes.
    async registrarPresenca(id, campo, quando, concluir, db = prisma) {
        return await db.agendamento.update({
            where: { id: parseInt(id) },
            data: {
                [campo]: quando,
                ...(campo === 'presenca_monitor_em' ? { ausente_em: null } : {}),
                ...(concluir ? { status: 'concluido' } : {})
            }
        });
    }

    // --- Faltas (plano 12) ---

    // O monitor marca a ausência; a presença que ele tinha confirmado deixa de valer
    async marcarAusencia(id, quando, db = prisma) {
        return await db.agendamento.update({
            where: { id: parseInt(id) },
            data: { ausente_em: quando, presenca_monitor_em: null }
        });
    }

    // Datas das faltas do aluno desde `desde` (para o cálculo do bloqueio)
    async datasDeAusencia(idAluno, desde, db = prisma) {
        const linhas = await db.agendamento.findMany({
            where: { id_aluno: parseInt(idAluno), ausente_em: { gte: desde } },
            select: { ausente_em: true }
        });
        return linhas.map((l) => l.ausente_em);
    }
}

module.exports = new AgendamentoRepository();
