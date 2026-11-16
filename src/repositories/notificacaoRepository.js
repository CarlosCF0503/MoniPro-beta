// src/repositories/notificacaoRepository.js
// Plano 3 (RF-010, RN-011): fila de e-mails de aviso (tabela notificacoes).

const prisma = require('../config/bancoDeDados');

// Inscrições que ainda contam: as mesmas da contagem de lugares da vaga
const INSCRICAO_ATIVA = { status: { not: 'cancelado' } };

class NotificacaoRepository {
    /**
     * Grava os avisos. A chave única descarta o que já existe (o mesmo lembrete enfileirado de
     * novo, por exemplo), sem erro.
     * @param {Array<{id_usuario:number, modelo:string, dados:object, chave:string}>} lista
     */
    async enfileirar(lista, db = prisma) {
        if (!lista.length) return 0;
        const { count } = await db.notificacao.createMany({ data: lista, skipDuplicates: true });
        return count;
    }

    // O que os e-mails mostram sobre a vaga: disciplina, monitor, quando, onde e assunto
    async buscarVaga(idMonitoria, db = prisma) {
        return await db.monitoria.findUnique({
            where: { id: parseInt(idMonitoria) },
            select: {
                id: true,
                horario: true,
                local: true,
                descricao: true,
                id_disciplina: true,
                disciplina: { select: { nome: true } },
                monitor: { select: { nome_completo: true } }
            }
        });
    }

    async buscarInscritosAtivos(idMonitoria, db = prisma) {
        return await db.agendamento.findMany({
            where: { id_monitoria: parseInt(idMonitoria), ...INSCRICAO_ATIVA },
            select: { id: true, id_aluno: true }
        });
    }

    // Inscrições ativas, em vagas ativas, que começam dentro da janela do lembrete
    async buscarSessoesParaLembrete(de, ate) {
        return await prisma.agendamento.findMany({
            where: {
                ...INSCRICAO_ATIVA,
                data_hora: { gt: de, lte: ate },
                monitoria: { status: 'ativa' }
            },
            select: { id: true, id_aluno: true, data_hora: true, id_monitoria: true }
        });
    }

    /**
     * Reserva até `limite` avisos vencidos: adia o enviar_apos deles até `reservarAte`, numa
     * única instrução com FOR UPDATE SKIP LOCKED. Dois processos ao mesmo tempo nunca pegam o
     * mesmo aviso, e um aviso reservado por um processo que caiu volta para a fila sozinho.
     */
    async reservarLote(agora, reservarAte, limite) {
        return await prisma.$queryRaw`
            UPDATE "notificacoes" SET "enviar_apos" = ${reservarAte}
            WHERE "id" IN (
                SELECT "id" FROM "notificacoes"
                WHERE "status" = 'pendente' AND "enviar_apos" <= ${agora}
                ORDER BY "enviar_apos"
                LIMIT ${limite}
                FOR UPDATE SKIP LOCKED
            )
            RETURNING "id", "id_usuario", "modelo", "dados", "tentativas"
        `;
    }

    async buscarDestinatario(idUsuario) {
        return await prisma.usuario.findUnique({
            where: { id: idUsuario },
            select: { email: true, nome_completo: true, tipo_usuario: true, anonimizado_em: true }
        });
    }

    async marcarEnviada(id, agora) {
        await prisma.notificacao.update({
            where: { id },
            data: { status: 'enviada', enviada_em: agora, tentativas: { increment: 1 } }
        });
    }

    async registrarFalha(id, { tentativas, proximaTentativa, erro, desistir }) {
        await prisma.notificacao.update({
            where: { id },
            data: {
                tentativas,
                ultimo_erro: String(erro).slice(0, 500),
                ...(desistir ? { status: 'falhou' } : { enviar_apos: proximaTentativa })
            }
        });
    }

    // Retenção (LGPD): avisos já resolvidos (enviados ou desistidos) antes do limite
    async contarAntigas(limite) {
        return await prisma.notificacao.count({
            where: { status: { in: ['enviada', 'falhou'] }, criado_em: { lt: limite } }
        });
    }

    async apagarAntigas(limite) {
        const { count } = await prisma.notificacao.deleteMany({
            where: { status: { in: ['enviada', 'falhou'] }, criado_em: { lt: limite } }
        });
        return count;
    }
}

module.exports = new NotificacaoRepository();
