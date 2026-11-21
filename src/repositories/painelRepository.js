// src/repositories/painelRepository.js
// Plano 7 (RF-012): leituras do painel da coordenação e o registro de auditoria. As contas ficam
// em src/utils/painelCoordenacao.js; aqui só uma consulta por bloco, sem N+1.

const prisma = require('../config/bancoDeDados');

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

    /** Monitores com certificado válido (não substituído nem revogado) no semestre. */
    async monitoresComCertificado(periodo) {
        const linhas = await prisma.certificado.findMany({
            where: { periodo, situacao: 'valido' },
            select: { id_usuario: true },
            distinct: ['id_usuario']
        });
        return new Set(linhas.map((l) => l.id_usuario));
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
