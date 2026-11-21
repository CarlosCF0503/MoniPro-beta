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

    /** Disciplinas criadas por monitores esperando revisão, com quem criou e quantas vagas têm. */
    async listarDisciplinasPendentes() {
        const linhas = await prisma.disciplina.findMany({
            where: { status: 'pendente' },
            orderBy: [{ criada_em: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                nome: true,
                criada_em: true,
                id_criador: true,
                _count: { select: { monitorias: true } }
            }
        });
        const ids = [...new Set(linhas.map((l) => l.id_criador).filter(Boolean))];
        const criadores = ids.length
            ? await prisma.usuario.findMany({
                  where: { id: { in: ids } },
                  select: { id: true, nome_completo: true }
              })
            : [];
        const nomes = new Map(criadores.map((u) => [u.id, u.nome_completo]));
        return linhas.map(({ _count, ...l }) => ({
            ...l,
            criador: nomes.get(l.id_criador) || null,
            vagas: _count.monitorias
        }));
    }

    async listarDisciplinasAprovadas() {
        return await prisma.disciplina.findMany({
            where: { status: 'aprovada' },
            orderBy: { nome: 'asc' },
            select: { id: true, nome: true }
        });
    }

    async buscarDisciplina(id, db = prisma) {
        return await db.disciplina.findUnique({
            where: { id },
            select: { id: true, nome: true, status: true, id_criador: true }
        });
    }

    /** Aprova se ainda estiver pendente (duas revisões ao mesmo tempo gravam uma). */
    async aprovarDisciplina(id, db = prisma) {
        const { count } = await db.disciplina.updateMany({
            where: { id, status: 'pendente' },
            data: { status: 'aprovada' }
        });
        return count;
    }

    /**
     * Junta a pendente `origem` na aprovada `destino`: as vagas e os pontos passam para o
     * destino e a origem é apagada. Devolve null se a origem não estava mais pendente.
     */
    async mesclarDisciplina(origem, destino, db) {
        const vagas = await db.monitoria.updateMany({
            where: { id_disciplina: origem },
            data: { id_disciplina: destino }
        });
        const pontos = await db.eventoPontuacao.updateMany({
            where: { id_disciplina: origem },
            data: { id_disciplina: destino }
        });
        const { count } = await db.disciplina.deleteMany({
            where: { id: origem, status: 'pendente' }
        });
        return count ? { vagas: vagas.count, pontos: pontos.count } : null;
    }

    /**
     * Plano 7 (faltas): inscrições das vagas que começaram entre `inicio` e `ate`, com aluno,
     * monitor e disciplina. `faltas` = com falta marcada; `semPresenca` = vaga não cancelada,
     * inscrição ativa, sem presença dos dois lados e sem falta.
     */
    async listarInscricoesParaFaltas(inicio, ate, limite = 300) {
        const select = {
            id: true,
            ausente_em: true,
            presenca_aluno_em: true,
            aluno: { select: { nome_completo: true } },
            monitoria: {
                select: {
                    horario: true,
                    monitor: { select: { nome_completo: true } },
                    disciplina: { select: { nome: true } }
                }
            }
        };
        const naJanela = { horario: { gte: inicio, lt: ate } };
        const [faltas, semPresenca] = await Promise.all([
            prisma.agendamento.findMany({
                where: { ausente_em: { not: null }, monitoria: naJanela },
                orderBy: [{ ausente_em: 'desc' }, { id: 'desc' }],
                take: limite,
                select
            }),
            prisma.agendamento.findMany({
                where: {
                    ausente_em: null,
                    status: { notIn: ['concluido', 'cancelado', 'em_espera'] },
                    monitoria: { ...naJanela, status: { not: 'cancelada' } }
                },
                orderBy: [{ monitoria: { horario: 'desc' } }, { id: 'desc' }],
                take: limite,
                select
            })
        ]);
        return { faltas, semPresenca };
    }

    /** Nomes dos alunos (para a lista de bloqueados). */
    async nomesDeUsuarios(ids) {
        if (!ids.length) return new Map();
        const linhas = await prisma.usuario.findMany({
            where: { id: { in: ids } },
            select: { id: true, nome_completo: true }
        });
        return new Map(linhas.map((u) => [u.id, u.nome_completo]));
    }

    /** Anula a falta se ela ainda estiver marcada (duas anulações ao mesmo tempo gravam uma). */
    async anularFalta(id, db) {
        const { count } = await db.agendamento.updateMany({
            where: { id, ausente_em: { not: null } },
            data: { ausente_em: null }
        });
        return count;
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
