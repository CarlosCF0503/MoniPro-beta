// src/repositories/painelRepository.js
// Plano 7 (RF-012): leituras do painel da coordenação e o registro de auditoria. As contas ficam
// em src/utils/painelCoordenacao.js; aqui só uma consulta por bloco, sem N+1.

const prisma = require('../config/bancoDeDados');

const CAMPOS_CERTIFICADO = {
    id: true,
    codigo: true,
    periodo: true,
    carga_minutos: true,
    situacao: true,
    emitido_em: true,
    assinado_em: true,
    assinante_nome: true,
    usuario: { select: { nome_completo: true } }
};

class PainelRepository {
    /**
     * Vagas que começaram entre `inicio` e `ate` (com as canceladas), com monitor, disciplina e
     * as inscrições. A lista de espera fica de fora: não é inscrição.
     */
    async buscarVagas(inicio, ate) {
        const vagas = await prisma.monitoria.findMany({
            where: { horario: { gte: inicio, lt: ate } },
            select: {
                horario: true,
                data_fim: true,
                status: true,
                id_monitor: true,
                monitor: { select: { nome_completo: true, email: true } },
                disciplina: { select: { nome: true } },
                inscricoes: {
                    where: { status: { not: 'em_espera' } },
                    select: { id_aluno: true, status: true, ausente_em: true }
                }
            },
            orderBy: { horario: 'asc' }
        });
        return vagas.map((v) => ({
            horario: v.horario,
            data_fim: v.data_fim,
            status: v.status,
            id_monitor: v.id_monitor,
            monitor: { nome: v.monitor.nome_completo, email: v.monitor.email },
            disciplina: v.disciplina.nome,
            inscricoes: v.inscricoes
        }));
    }

    /** Faltas marcadas desde `desde`, para contar quem está bloqueado agora (plano 12). */
    async buscarAusencias(desde) {
        return await prisma.agendamento.findMany({
            where: { ausente_em: { gte: desde } },
            select: { id_aluno: true, ausente_em: true }
        });
    }

    /**
     * Certificado válido (não substituído nem revogado) de cada monitor no semestre:
     * id do monitor -> true se a coordenação já assinou.
     */
    async monitoresComCertificado(periodo) {
        const linhas = await prisma.certificado.findMany({
            where: { periodo, situacao: 'valido' },
            select: { id_usuario: true, assinado_em: true }
        });
        return new Map(linhas.map((l) => [l.id_usuario, Boolean(l.assinado_em)]));
    }

    /**
     * Certificados para a coordenação. pendente = válido e ainda sem assinatura (de qualquer
     * semestre); assinado = válido e assinado, do semestre pedido.
     */
    async listarCertificados({ situacao, periodo }) {
        const where =
            situacao === 'pendente'
                ? { situacao: 'valido', assinado_em: null }
                : {
                      situacao: 'valido',
                      assinado_em: { not: null },
                      ...(periodo ? { periodo } : {})
                  };
        return await prisma.certificado.findMany({
            where,
            orderBy:
                situacao === 'pendente'
                    ? [{ emitido_em: 'asc' }, { id: 'asc' }]
                    : [{ assinado_em: 'desc' }, { id: 'desc' }],
            // O snapshot traz o total de sessões guardado na emissão
            select: { ...CAMPOS_CERTIFICADO, snapshot: true }
        });
    }

    async buscarCertificado(id, db = prisma) {
        return await db.certificado.findUnique({
            where: { id },
            select: { ...CAMPOS_CERTIFICADO, snapshot: true, id_usuario: true }
        });
    }

    /** Assina se ainda for válido e sem assinatura: duas assinaturas ao mesmo tempo gravam uma. */
    async assinarCertificado(id, { idAssinante, nome, quando }, db = prisma) {
        const { count } = await db.certificado.updateMany({
            where: { id, situacao: 'valido', assinado_em: null },
            data: { assinado_em: quando, id_assinante: idAssinante, assinante_nome: nome }
        });
        return count;
    }

    /** Titular do certificado, para o aviso por e-mail (null se a conta foi excluída). */
    async contatoDoUsuario(id, db = prisma) {
        const u = await db.usuario.findUnique({
            where: { id },
            select: { nome_completo: true, email: true, anonimizado_em: true }
        });
        return u && !u.anonimizado_em ? { nome: u.nome_completo, email: u.email } : null;
    }

    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }

    async listarAuditoria(quantos) {
        const linhas = await prisma.auditoria.findMany({
            orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
            take: quantos,
            select: {
                acao: true,
                alvo: true,
                descricao: true,
                criado_em: true,
                usuario: { select: { nome_completo: true } }
            }
        });
        return linhas.map(({ usuario, ...l }) => ({ ...l, usuario: usuario.nome_completo }));
    }

    /** Uma linha de auditoria; `db` permite gravar dentro da mesma transação da ação. */
    async registrar({ id_usuario, acao, alvo, descricao }, db = prisma) {
        return await db.auditoria.create({ data: { id_usuario, acao, alvo, descricao } });
    }
}

module.exports = new PainelRepository();
