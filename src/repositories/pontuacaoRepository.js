// src/repositories/pontuacaoRepository.js
// Plano 5 (RN-008 revisada, RF-011): eventos de pontuação (eventos_pontuacao).

const prisma = require('../config/bancoDeDados');

// Quem aparece em ranking e posição: contas ativas (a anonimizada some, mas os pontos ficam)
const contaAtiva = (tipo) => ({ usuario: { tipo_usuario: tipo, anonimizado_em: null } });

class PontuacaoRepository {
    /**
     * Grava um evento e soma os pontos no saldo (Usuario.pontos), na mesma transação. A chave
     * única descarta a repetição: o mesmo ponto nunca entra duas vezes.
     * @returns {Promise<boolean>} true se o evento era novo
     */
    async registrar(evento, db = prisma) {
        const { count } = await db.eventoPontuacao.createMany({
            data: [evento],
            skipDuplicates: true
        });
        if (count === 0) return false;
        await db.usuario.update({
            where: { id: evento.id_usuario },
            data: { pontos: { increment: evento.pontos } }
        });
        return true;
    }

    async buscarSaldo(idUsuario) {
        return await prisma.usuario.findUnique({
            where: { id: idUsuario },
            select: { pontos: true, tipo_usuario: true }
        });
    }

    async buscarEventos(idUsuario, limite) {
        return await prisma.eventoPontuacao.findMany({
            where: { id_usuario: idUsuario },
            orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
            take: limite,
            select: {
                tipo: true,
                pontos: true,
                criado_em: true,
                disciplina: { select: { nome: true } }
            }
        });
    }

    // Disciplina em que a pessoa mais pontuou no semestre (para mostrar a posição dela)
    async buscarDisciplinaPrincipal(idUsuario, periodo) {
        const grupos = await prisma.eventoPontuacao.groupBy({
            by: ['id_disciplina'],
            where: { id_usuario: idUsuario, periodo, id_disciplina: { not: null } },
            _sum: { pontos: true }
        });
        const positivos = grupos.filter((g) => g._sum.pontos > 0);
        if (!positivos.length) return null;
        positivos.sort((a, b) => b._sum.pontos - a._sum.pontos);
        return positivos[0].id_disciplina;
    }

    /**
     * Pontos de cada conta de um tipo numa disciplina e semestre, maior primeiro.
     * @returns {Promise<Array<{id_usuario:number, pontos:number}>>}
     */
    async somarPorUsuario(idDisciplina, periodo, tipo) {
        const grupos = await prisma.eventoPontuacao.groupBy({
            by: ['id_usuario'],
            where: { id_disciplina: idDisciplina, periodo, ...contaAtiva(tipo) },
            _sum: { pontos: true }
        });
        return grupos
            .map((g) => ({ id_usuario: g.id_usuario, pontos: g._sum.pontos || 0 }))
            .filter((g) => g.pontos > 0)
            .sort((a, b) => b.pontos - a.pontos);
    }

    async buscarNomes(ids) {
        return await prisma.usuario.findMany({
            where: { id: { in: ids } },
            select: { id: true, nome_completo: true }
        });
    }

    // Monitorias finalizadas dos monitores na disciplina e no semestre: sessões e duração
    async buscarSessoes(ids, idDisciplina, { inicio, fim }) {
        return await prisma.monitoria.findMany({
            where: {
                id_monitor: { in: ids },
                id_disciplina: idDisciplina,
                status: { in: ['realizada', 'concluida'] },
                data_fim: { not: null },
                horario: { gte: inicio, lt: fim }
            },
            select: { id_monitor: true, horario: true, data_fim: true }
        });
    }

    async buscarNomeDisciplina(idDisciplina) {
        const d = await prisma.disciplina.findUnique({
            where: { id: idDisciplina },
            select: { nome: true }
        });
        return d ? d.nome : null;
    }
}

module.exports = new PontuacaoRepository();
