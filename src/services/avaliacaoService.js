// src/services/avaliacaoService.js
// Plano 6 (RF-006/007, RN-013): o aluno avalia a monitoria; o monitor vê o resumo sem saber
// quem avaliou; a coordenação oculta comentário ofensivo ou pessoal (a nota sai da média).

const avaliacaoRepository = require('../repositories/avaliacaoRepository');
const agendamentoRepository = require('../repositories/agendamentoRepository');
const painelRepository = require('../repositories/painelRepository');
const { resumirAvaliacoes } = require('../utils/avaliacao');
const { DIAS_PRAZO_CONFIRMACAO } = require('../utils/regrasConclusao');
const { ErroAplicacao, ErroNaoEncontrado, ErroValidacao } = require('../utils/erros');
const logger = require('../utils/logger');

const DIA = 24 * 60 * 60 * 1000;
const COMENTARIO_MAX = 300;
const MOTIVO_MIN = 10;
const MOTIVO_MAX = 300;

function validar(corpo) {
    const nota = corpo ? corpo.nota : undefined;
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
        const m = 'Escolha uma nota de 1 a 5.';
        throw new ErroValidacao(m, { nota: m });
    }
    const bruto = corpo.comentario;
    if (bruto !== undefined && bruto !== null && typeof bruto !== 'string') {
        const m = 'O comentário deve ser um texto.';
        throw new ErroValidacao(m, { comentario: m });
    }
    const comentario = typeof bruto === 'string' ? bruto.trim() : '';
    if (comentario.length > COMENTARIO_MAX) {
        const m = `O comentário deve ter no máximo ${COMENTARIO_MAX} caracteres.`;
        throw new ErroValidacao(m, { comentario: m });
    }
    return { nota, comentario: comentario || null };
}

class AvaliacaoService {
    async avaliar(idAgendamento, idAluno, corpo, agora = new Date()) {
        const { nota, comentario } = validar(corpo);
        const criada = await avaliacaoRepository.emTransacao(async (tx) => {
            const ag = await agendamentoRepository.bloquearParaPresenca(idAgendamento, tx);
            if (!ag || ag.id_aluno !== idAluno)
                throw new ErroNaoEncontrado('Inscrição não encontrada.');
            if (ag.status !== 'concluido')
                throw new ErroAplicacao(
                    'Dá para avaliar depois que você e o monitor confirmarem a presença.',
                    422
                );
            if (agora - new Date(ag.horario) > DIAS_PRAZO_CONFIRMACAO * DIA)
                throw new ErroAplicacao(
                    `O prazo para avaliar terminou: ${DIAS_PRAZO_CONFIRMACAO} dias depois da monitoria.`,
                    422
                );
            if (await avaliacaoRepository.existeParaInscricao(ag.id, tx))
                throw new ErroAplicacao('Você já avaliou esta monitoria.', 409);
            return await avaliacaoRepository.criar(
                {
                    id_agendamento: ag.id,
                    id_aluno: idAluno,
                    id_monitor: ag.id_monitor,
                    nota,
                    comentario
                },
                tx
            );
        });
        // Sem o comentário no log
        logger.info({ id_agendamento: idAgendamento, nota }, 'Monitoria avaliada');
        return criada;
    }

    /** O que o monitor vê (só as visíveis; sem nome nem data exata). */
    async resumoDoMonitor(idMonitor) {
        return resumirAvaliacoes(await avaliacaoRepository.visiveisDoMonitor(idMonitor));
    }

    /** Lista da coordenação: comentários do período, visíveis e ocultos. */
    async paraModeracao(inicio, ate) {
        const linhas = await avaliacaoRepository.comComentarioNoPeriodo(inicio, ate);
        return linhas.map((a) => ({
            id: a.id,
            monitor: a.agendamento.monitoria.monitor.nome_completo,
            disciplina: a.agendamento.monitoria.disciplina.nome,
            nota: a.nota,
            comentario: a.comentario,
            criado_em: a.criado_em,
            oculto_em: a.oculto_em
        }));
    }

    async ocultar(id, motivoDigitado, coordenador, agora = new Date()) {
        const motivo = String(motivoDigitado || '').trim();
        if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX)
            throw new ErroAplicacao(
                `Escreva o motivo com ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres. Ele fica no registro de atividade.`,
                400
            );
        return await this.#moderar(id, true, coordenador, agora, motivo);
    }

    async reexibir(id, coordenador, agora = new Date()) {
        return await this.#moderar(id, false, coordenador, agora);
    }

    async #moderar(id, ocultar, coordenador, agora, motivo) {
        const registro = await avaliacaoRepository.emTransacao(async (tx) => {
            const a = await avaliacaoRepository.buscar(id, tx);
            if (!a) throw new ErroNaoEncontrado('Avaliação não encontrada.');
            if (ocultar && a.oculto_em)
                throw new ErroAplicacao('Este comentário já está oculto.', 409);
            if (!ocultar && !a.oculto_em)
                throw new ErroAplicacao('Este comentário já está visível.', 409);
            if (
                !(await avaliacaoRepository.moderar(
                    id,
                    { ocultar, idModerador: coordenador.id, quando: agora },
                    tx
                ))
            )
                throw new ErroAplicacao(
                    'Este comentário acabou de mudar. Recarregue o painel.',
                    409
                );
            return await painelRepository.registrar(
                {
                    id_usuario: coordenador.id,
                    acao: ocultar ? 'ocultar_avaliacao' : 'reexibir_avaliacao',
                    alvo: `avaliacao:${id}`,
                    descricao: (ocultar
                        ? `Ocultou o comentário da avaliação ${id}: ${motivo}`
                        : `Mostrou de novo o comentário da avaliação ${id}`
                    ).slice(0, 300)
                },
                tx
            );
        });
        logger.info(
            { id_avaliacao: id, ocultar, id_coordenador: coordenador.id },
            'Comentário moderado'
        );
        return { registro: { ...registro, usuario: coordenador.nome } };
    }
}

module.exports = new AvaliacaoService();
