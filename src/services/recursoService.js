// src/services/recursoService.js
// Plano 7: o aluno pede revisão da falta com um comprovante (atestado); a coordenação aceita
// (a falta é anulada, sem virar presença) ou recusa com motivo. Decisões de 21/11: um pedido por
// falta, até 30 dias depois da marcação; arquivo de até 5 MB, apagado em 180 dias.

const recursoRepository = require('../repositories/recursoRepository');
const painelRepository = require('../repositories/painelRepository');
const { lerComprovante } = require('../utils/comprovante');
const { enviarSemEsperar } = require('./email');
const { ErroAplicacao, ErroNaoEncontrado, ErroValidacao } = require('../utils/erros');
const logger = require('../utils/logger');

const DIA = 24 * 60 * 60 * 1000;
const DIAS_PARA_PEDIR = 30;
const JUSTIFICATIVA_MIN = 10;
const JUSTIFICATIVA_MAX = 500;
const MOTIVO_MIN = 10;
const MOTIVO_MAX = 300;

const dataCurta = (d) =>
    new Date(d).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });

/** Linha da lista do painel (sem os bytes do arquivo). */
function linhaRecurso(r) {
    return {
        id: r.id,
        id_agendamento: r.id_agendamento,
        aluno: r.agendamento.aluno.nome_completo,
        monitor: r.agendamento.monitoria.monitor.nome_completo,
        disciplina: r.agendamento.monitoria.disciplina.nome,
        horario: r.agendamento.monitoria.horario,
        justificativa: r.justificativa,
        criado_em: r.criado_em,
        arquivo: { nome: r.arquivo_nome, tipo: r.arquivo_tipo, tamanho: r.arquivo_tamanho }
    };
}

async function avisarAluno(r, modelo, extra) {
    const contato = await painelRepository.contatoDoUsuario(r.id_aluno);
    if (contato)
        enviarSemEsperar({ para: contato.email, modelo, dados: { nome: contato.nome, ...extra } });
}

class RecursoService {
    /** O aluno dono da inscrição pede a revisão da falta. */
    async pedir(idAgendamento, idAluno, corpo, agora = new Date()) {
        const justificativa = String((corpo && corpo.justificativa) || '').trim();
        if (justificativa.length < JUSTIFICATIVA_MIN || justificativa.length > JUSTIFICATIVA_MAX) {
            const m = `Explique o motivo da falta com ${JUSTIFICATIVA_MIN} a ${JUSTIFICATIVA_MAX} caracteres.`;
            throw new ErroValidacao(m, { justificativa: m });
        }
        const arquivo = lerComprovante(corpo && corpo.arquivo);
        if (arquivo.erro) throw new ErroValidacao(arquivo.erro, { arquivo: arquivo.erro });

        const recurso = await recursoRepository.emTransacao(async (tx) => {
            const ag = await recursoRepository.bloquearInscricao(idAgendamento, tx);
            // Inscrição de outra pessoa responde igual à inexistente
            if (!ag || ag.id_aluno !== idAluno)
                throw new ErroNaoEncontrado('Inscrição não encontrada.');
            if (!ag.ausente_em)
                throw new ErroAplicacao('Esta inscrição não tem falta registrada.', 409);
            if (agora - new Date(ag.ausente_em) > DIAS_PARA_PEDIR * DIA)
                throw new ErroAplicacao(
                    `O prazo para pedir a revisão terminou: ${DIAS_PARA_PEDIR} dias depois da falta.`,
                    422
                );
            if (await recursoRepository.buscarPorAgendamento(ag.id, tx))
                throw new ErroAplicacao('Você já pediu a revisão desta falta.', 409);
            return await recursoRepository.criar(
                {
                    id_agendamento: ag.id,
                    id_aluno: idAluno,
                    justificativa,
                    arquivo_nome: arquivo.nome,
                    arquivo_tipo: arquivo.tipo,
                    arquivo_tamanho: arquivo.tamanho,
                    arquivo: arquivo.conteudo
                },
                tx
            );
        });
        // Nunca registra o nome do arquivo nem a justificativa: podem ter dado de saúde
        logger.info(
            { id_agendamento: idAgendamento, tamanho: arquivo.tamanho },
            'Revisão de falta pedida'
        );
        return recurso;
    }

    async pendentes() {
        return (await recursoRepository.listarPendentes()).map(linhaRecurso);
    }

    /** O arquivo, só para a coordenação (a rota garante o papel). */
    async arquivo(id) {
        const a = await recursoRepository.buscarArquivo(id);
        if (!a) throw new ErroNaoEncontrado('Pedido não encontrado ou já apagado pela retenção.');
        return { conteudo: Buffer.from(a.arquivo), nome: a.arquivo_nome, tipo: a.arquivo_tipo };
    }

    /** Aceitar: anula a falta (sem virar presença) e responde ao aluno. */
    async aceitar(id, coordenador, agora = new Date()) {
        const { r, registro } = await recursoRepository.emTransacao(async (tx) => {
            const r = await exigirPendente(id, tx);
            // A falta pode já ter sido anulada à mão ou pelo monitor: o pedido é aceito do mesmo jeito
            await painelRepository.anularFalta(r.id_agendamento, tx);
            if (
                !(await recursoRepository.decidir(
                    id,
                    { status: 'aceito', idDecisor: coordenador.id, quando: agora },
                    tx
                ))
            )
                throw new ErroAplicacao(
                    'Este pedido acabou de ser decidido. Recarregue o painel.',
                    409
                );
            const registro = await painelRepository.registrar(
                {
                    id_usuario: coordenador.id,
                    acao: 'aceitar_recurso',
                    alvo: `agendamento:${r.id_agendamento}`,
                    descricao: `Aceitou o pedido de revisão ${id} e anulou a falta da inscrição ${r.id_agendamento}`
                },
                tx
            );
            return { r, registro };
        });
        logger.info({ id_recurso: id, id_coordenador: coordenador.id }, 'Revisão de falta aceita');
        await avisarAluno(r, 'recurso-aceito', { enviado_em: dataCurta(r.criado_em) });
        return { registro: { ...registro, usuario: coordenador.nome } };
    }

    /** Recusar: a falta continua; o aluno recebe o motivo. */
    async recusar(id, motivoDigitado, coordenador, agora = new Date()) {
        const motivo = String(motivoDigitado || '').trim();
        if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX)
            throw new ErroAplicacao(
                `Escreva o motivo com ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres. O aluno recebe esse texto.`,
                400
            );
        const { r, registro } = await recursoRepository.emTransacao(async (tx) => {
            const r = await exigirPendente(id, tx);
            if (
                !(await recursoRepository.decidir(
                    id,
                    { status: 'recusado', motivo, idDecisor: coordenador.id, quando: agora },
                    tx
                ))
            )
                throw new ErroAplicacao(
                    'Este pedido acabou de ser decidido. Recarregue o painel.',
                    409
                );
            const registro = await painelRepository.registrar(
                {
                    id_usuario: coordenador.id,
                    acao: 'recusar_recurso',
                    alvo: `agendamento:${r.id_agendamento}`,
                    descricao:
                        `Recusou o pedido de revisão ${id} (inscrição ${r.id_agendamento}): ${motivo}`.slice(
                            0,
                            300
                        )
                },
                tx
            );
            return { r, registro };
        });
        logger.info(
            { id_recurso: id, id_coordenador: coordenador.id },
            'Revisão de falta recusada'
        );
        await avisarAluno(r, 'recurso-recusado', { enviado_em: dataCurta(r.criado_em), motivo });
        return { registro: { ...registro, usuario: coordenador.nome } };
    }
}

async function exigirPendente(id, tx) {
    const r = await recursoRepository.buscar(id, tx);
    if (!r) throw new ErroNaoEncontrado('Pedido não encontrado.');
    if (r.status !== 'pendente') throw new ErroAplicacao('Este pedido já foi decidido.', 409);
    return r;
}

module.exports = new RecursoService();
module.exports.DIAS_PARA_PEDIR = DIAS_PARA_PEDIR;
