// src/services/painelService.js
// Plano 7 (RF-012): painel da coordenação. Indicadores do semestre, tabela de monitores e o
// registro de auditoria. Só leitura neste PR; as ações (assinar e revogar certificados, revisar
// disciplinas) entram nos próximos e gravam a auditoria com `registrar`.

const painelRepository = require('../repositories/painelRepository');
const certificadoRepository = require('../repositories/certificadoRepository');
const { enviarSemEsperar } = require('./email');
const { ErroAplicacao, ErroNaoEncontrado } = require('../utils/erros');
const logger = require('../utils/logger');
const { periodoDe, limitesDoPeriodo, nomeDoPeriodo, periodoAnterior } = require('../utils/periodo');
const { resumirSemestre, resumirMonitores } = require('../utils/painelCoordenacao');
const { calcularRestricao, DIAS_CONSULTA } = require('../utils/restricao');

const DIA = 24 * 60 * 60 * 1000;
// Motivo da revogação: aparece para o monitor no e-mail e fica no certificado
const MOTIVO_MIN = 10;
const MOTIVO_MAX = 300;
// Quantos semestres aparecem no seletor (o atual e os anteriores)
const SEMESTRES_NO_SELETOR = 4;

function janela(periodo, agora) {
    const { inicio, fim } = limitesDoPeriodo(periodo);
    return { inicio, fim, ate: fim < agora ? fim : agora };
}

/** Quantos alunos estão bloqueados agora pela regra de faltas. */
function contarBloqueados(ausencias, agora) {
    const porAluno = new Map();
    for (const a of ausencias) {
        if (!porAluno.has(a.id_aluno)) porAluno.set(a.id_aluno, []);
        porAluno.get(a.id_aluno).push(a.ausente_em);
    }
    let bloqueados = 0;
    for (const datas of porAluno.values()) if (calcularRestricao(datas, agora)) bloqueados += 1;
    return bloqueados;
}

function semestresDoSeletor(agora) {
    const lista = [periodoDe(agora)];
    while (lista.length < SEMESTRES_NO_SELETOR)
        lista.push(periodoAnterior(lista[lista.length - 1]));
    return lista;
}

const horasTexto = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};
const codigoLegivel = (c) => c.match(/.{1,4}/g).join('-');

/** Linha da lista de certificados do painel. */
function linhaCertificado(c) {
    return {
        id: c.id,
        monitor: c.usuario.nome_completo,
        codigo: c.codigo,
        periodo: c.periodo,
        carga_minutos: c.carga_minutos,
        sessoes:
            c.snapshot && Number.isInteger(c.snapshot.sessoes_total)
                ? c.snapshot.sessoes_total
                : null,
        emitido_em: c.emitido_em,
        assinado_em: c.assinado_em,
        assinante: c.assinante_nome
    };
}

/** 404 para inexistente; 409 para o que não pode mais mudar. */
function exigirValido(c, acao) {
    if (!c) throw new ErroNaoEncontrado('Certificado não encontrado.');
    if (c.situacao === 'revogado')
        throw new ErroAplicacao('Este certificado já foi revogado.', 409);
    if (acao === 'assinar' && c.situacao === 'substituido')
        throw new ErroAplicacao(
            'Este certificado foi substituído por um emitido depois. Assine o mais recente.',
            409
        );
    if (acao === 'assinar' && c.assinado_em)
        throw new ErroAplicacao('Este certificado já foi assinado.', 409);
}

function avisarTitular(contato, modelo, c, extra) {
    if (!contato) return;
    enviarSemEsperar({
        para: contato.email,
        modelo,
        dados: {
            nome: contato.nome,
            semestre: nomeDoPeriodo(c.periodo),
            carga_minutos: c.carga_minutos,
            codigo: codigoLegivel(c.codigo),
            ...extra
        }
    });
}

class PainelService {
    async resumo(periodo, agora = new Date()) {
        const p = periodo || periodoDe(agora);
        const anterior = periodoAnterior(p);
        const atual = janela(p, agora);
        const antes = janela(anterior, agora);
        // O semestre que ainda não começou não tem vaga para buscar
        const vazio = (j) => j.inicio >= j.ate;
        const [vagas, vagasAntes, ausencias] = await Promise.all([
            vazio(atual) ? [] : painelRepository.buscarVagas(atual.inicio, atual.ate),
            vazio(antes) ? [] : painelRepository.buscarVagas(antes.inicio, antes.ate),
            painelRepository.buscarAusencias(new Date(agora.getTime() - DIAS_CONSULTA * DIA))
        ]);
        const r = resumirSemestre(vagas, { inicio: atual.inicio, fim: atual.fim, agora });
        const a = resumirSemestre(vagasAntes, { inicio: antes.inicio, fim: antes.fim, agora });
        return {
            periodo: p,
            rotulo_periodo: nomeDoPeriodo(p),
            periodos: semestresDoSeletor(agora),
            periodo_anterior: anterior,
            atualizado_em: agora.toISOString(),
            ...r,
            inscricoes: { ...r.inscricoes, bloqueados: contarBloqueados(ausencias, agora) },
            anterior: a.sessoes
                ? {
                      sessoes: a.sessoes,
                      minutos: a.minutos,
                      alunos: a.alunos,
                      taxa_presenca: a.taxa_presenca
                  }
                : null
        };
    }

    async monitores(periodo, agora = new Date()) {
        const p = periodo || periodoDe(agora);
        const j = janela(p, agora);
        if (j.inicio >= j.ate) return [];
        const [vagas, comCertificado] = await Promise.all([
            painelRepository.buscarVagas(j.inicio, j.ate),
            painelRepository.monitoresComCertificado(p)
        ]);
        return resumirMonitores(vagas, { fim: j.fim, agora, comCertificado });
    }

    /** pendente: válidos sem assinatura (todos os semestres); assinado: do semestre pedido. */
    async certificados(situacao, periodo, agora = new Date()) {
        const p = situacao === 'assinado' ? periodo || periodoDe(agora) : undefined;
        const linhas = await painelRepository.listarCertificados({ situacao, periodo: p });
        return linhas.map(linhaCertificado);
    }

    /** As sessões que entraram na carga, como foram guardadas na emissão. */
    async sessoesDoCertificado(id) {
        const c = await painelRepository.buscarCertificado(id);
        if (!c) throw new ErroNaoEncontrado('Certificado não encontrado.');
        const sessoes = (c.snapshot.sessoes || []).map((s) => ({
            data: s.data,
            disciplina: s.disciplina,
            minutos: s.minutos
        }));
        return { ...linhaCertificado(c), sessoes };
    }

    /**
     * Assinatura da coordenação: o certificado continua o mesmo (mesmo código), só passa a
     * mostrar quem assinou e quando. Grava a auditoria na mesma transação e avisa o monitor.
     */
    async assinarCertificado(id, coordenador, agora = new Date()) {
        const { c, registro } = await painelRepository.emTransacao(async (tx) => {
            const c = await painelRepository.buscarCertificado(id, tx);
            exigirValido(c, 'assinar');
            const n = await painelRepository.assinarCertificado(
                id,
                { idAssinante: coordenador.id, nome: coordenador.nome, quando: agora },
                tx
            );
            if (!n)
                throw new ErroAplicacao(
                    'Este certificado acabou de mudar. Recarregue o painel.',
                    409
                );
            const registro = await painelRepository.registrar(
                {
                    id_usuario: coordenador.id,
                    acao: 'assinar_certificado',
                    alvo: `certificado:${id}`,
                    descricao: `Assinou o certificado de ${c.usuario.nome_completo} (${c.periodo}, ${horasTexto(c.carga_minutos)})`
                },
                tx
            );
            return { c, registro };
        });
        logger.info({ id_certificado: id, id_coordenador: coordenador.id }, 'Certificado assinado');
        avisarTitular(
            await painelRepository.contatoDoUsuario(c.id_usuario),
            'certificado-assinado',
            c,
            {
                assinante: coordenador.nome
            }
        );
        return {
            certificado: {
                ...linhaCertificado(c),
                assinado_em: agora,
                assinante: coordenador.nome
            },
            registro: { ...registro, usuario: coordenador.nome }
        };
    }

    /**
     * Revogação pelo painel (substitui o script no dia a dia). Vale para o válido, assinado ou
     * não, e para o substituído. O monitor pode emitir outro depois (decisão de 21/11).
     */
    async revogarCertificado(id, motivoDigitado, coordenador, agora = new Date()) {
        const motivo = String(motivoDigitado || '').trim();
        if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX)
            throw new ErroAplicacao(
                `Escreva o motivo com ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres. Ele aparece para o monitor.`,
                400
            );
        const { c, registro } = await painelRepository.emTransacao(async (tx) => {
            const c = await painelRepository.buscarCertificado(id, tx);
            exigirValido(c, 'revogar');
            const n = await certificadoRepository.revogar(id, motivo, agora, tx);
            if (!n) throw new ErroAplicacao('Este certificado acabou de ser revogado.', 409);
            const registro = await painelRepository.registrar(
                {
                    id_usuario: coordenador.id,
                    acao: 'revogar_certificado',
                    alvo: `certificado:${id}`,
                    descricao:
                        `Revogou o certificado de ${c.usuario.nome_completo} (${c.periodo}): ${motivo}`.slice(
                            0,
                            300
                        )
                },
                tx
            );
            return { c, registro };
        });
        logger.info(
            { id_certificado: id, id_coordenador: coordenador.id },
            'Certificado revogado pela coordenação'
        );
        avisarTitular(
            await painelRepository.contatoDoUsuario(c.id_usuario),
            'certificado-revogado',
            c,
            { motivo }
        );
        return { registro: { ...registro, usuario: coordenador.nome } };
    }

    async auditoria(quantos = 20) {
        return await painelRepository.listarAuditoria(quantos);
    }

    async registrar(dados, db) {
        return await painelRepository.registrar(dados, db);
    }
}

module.exports = new PainelService();
module.exports.contarBloqueados = contarBloqueados;
