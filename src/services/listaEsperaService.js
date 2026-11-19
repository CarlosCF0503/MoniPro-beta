// src/services/listaEsperaService.js
// Plano 8 (RF-013, RN-015): lista de espera das vagas lotadas.
// - O aluno entra na fila de uma vaga ativa e lotada e vê a própria posição. A fila tem no
//   máximo tantas pessoas quantos lugares a vaga tem.
// - Quando um lugar abre (alguém cancela, o monitor aumenta os lugares, uma conta é excluída), o
//   primeiro da fila vira inscrito na hora e recebe o e-mail "abriu um lugar". Com menos de 2h
//   para o início, ninguém é promovido.
// - Quem é promovido com menos de 24h para o início pode cancelar até o horário (decisão de
//   18/11), como na vaga editada.
// Tudo roda com a linha da vaga travada (SELECT ... FOR UPDATE), a mesma trava da inscrição:
// cancelamentos e inscrições simultâneos nunca passam da capacidade.

const agendamentoRepository = require('../repositories/agendamentoRepository');
const notificacaoService = require('./notificacaoService');
const restricaoService = require('./restricaoService');
const logger = require('../utils/logger');
const { HORAS_MIN_PROMOCAO, tamanhoMaximoFila } = require('../config/listaEspera');
const { HORAS_MINIMAS_CANCELAMENTO } = require('../utils/validarAntecedencia');
const {
    ErroAplicacao,
    ErroConflito,
    ErroNaoEncontrado,
    ErroRegraNegocio
} = require('../utils/erros');

const HORA = 60 * 60 * 1000;

class ListaEsperaService {
    /**
     * Entra na fila de uma vaga lotada. Devolve a inscrição em espera e a posição (1 = próximo).
     */
    async entrar(idMonitoria, idAluno, agora = new Date()) {
        if (!Number.isInteger(idMonitoria)) {
            throw new ErroNaoEncontrado('Vaga de monitoria não encontrada.');
        }
        return await agendamentoRepository.emTransacao(async (tx) => {
            const vaga = await agendamentoRepository.bloquearMonitoria(idMonitoria, tx);
            if (!vaga) throw new ErroNaoEncontrado('Vaga de monitoria não encontrada.');
            // Plano 12: quem faltou demais também não entra na fila por um tempo
            await restricaoService.exigirSemRestricao(idAluno, tx);
            if (vaga.status !== 'ativa') {
                throw new ErroRegraNegocio(
                    'Esta vaga de monitoria não está aberta para inscrições.'
                );
            }
            const faltam = new Date(vaga.horario) - agora;
            if (faltam <= 0) {
                throw new ErroAplicacao(
                    'Esta monitoria já começou. Escolha um horário que ainda não aconteceu.',
                    422
                );
            }
            if (faltam < HORAS_MIN_PROMOCAO * HORA) {
                throw new ErroAplicacao(
                    `A lista de espera fecha ${HORAS_MIN_PROMOCAO}h antes do início.`,
                    422
                );
            }

            const existente = await agendamentoRepository.buscarPorAlunoEMonitoria(
                idAluno,
                idMonitoria,
                tx
            );
            if (existente) {
                throw new ErroConflito(
                    existente.status === 'em_espera'
                        ? 'Você já está na lista de espera desta vaga.'
                        : 'Você já está inscrito nesta monitoria.'
                );
            }

            const ocupadas = await agendamentoRepository.contarOcupadas(idMonitoria, tx);
            if (ocupadas < vaga.capacidade) {
                throw new ErroAplicacao(
                    'Esta vaga ainda tem lugar livre. Faça a inscrição normalmente.',
                    422
                );
            }
            const naFila = await agendamentoRepository.contarFila(idMonitoria, tx);
            if (naFila >= tamanhoMaximoFila(vaga.capacidade)) {
                throw new ErroConflito('A lista de espera desta vaga está cheia.');
            }

            const agendamento = await agendamentoRepository.criar(
                {
                    id_monitoria: vaga.id,
                    id_aluno: idAluno,
                    status: 'em_espera',
                    data_hora: vaga.horario
                },
                tx
            );
            return { agendamento, posicao: naFila + 1 };
        });
    }

    /**
     * Preenche os lugares livres com os primeiros da fila. Chamado dentro da transação de quem
     * liberou o lugar; a trava da vaga é tomada aqui (repetir a trava na mesma transação não
     * bloqueia). Devolve os promovidos.
     */
    async promover(idMonitoria, tx, agora = new Date()) {
        const vaga = await agendamentoRepository.bloquearMonitoria(idMonitoria, tx);
        if (!vaga || vaga.status !== 'ativa') return [];
        const faltam = new Date(vaga.horario) - agora;
        if (faltam < HORAS_MIN_PROMOCAO * HORA) return [];

        const livres = vaga.capacidade - (await agendamentoRepository.contarOcupadas(vaga.id, tx));
        if (livres <= 0) return [];
        const proximos = await agendamentoRepository.primeirosDaFila(vaga.id, livres, tx);
        if (!proximos.length) return [];

        const liberarCancelamento = faltam < HORAS_MINIMAS_CANCELAMENTO * HORA;
        for (const p of proximos) {
            await agendamentoRepository.promover(p.id, agora, liberarCancelamento, tx);
            await notificacaoService.avisarPromocao(
                {
                    idAgendamento: p.id,
                    idAluno: p.id_aluno,
                    idMonitoria: vaga.id,
                    podeCancelarAteOInicio: liberarCancelamento
                },
                tx
            );
        }
        logger.info(
            { id_monitoria: vaga.id, promovidos: proximos.length },
            'Lista de espera: lugar preenchido'
        );
        return proximos;
    }
}

module.exports = new ListaEsperaService();
