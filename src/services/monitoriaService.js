// src/services/monitoriaService.js
const monitoriaRepository = require('../repositories/monitoriaRepository');
const {
    validarAntecedenciaCancelamento,
    HORAS_MINIMAS_CANCELAMENTO
} = require('../utils/validarAntecedencia');
const logger = require('../utils/logger');
const {
    ErroValidacao,
    ErroRegraNegocio,
    ErroNaoAutorizado,
    ErroNaoEncontrado,
    ErroConflito
} = require('../utils/erros');

// RN-010: devolve o novo horário (Date) se ele de fato muda, ou null. Mudar dia ou horário
// exige 24h ou mais até o início atual, um horário que ainda não passou e nenhuma outra vaga
// ativa do mesmo monitor no mesmo horário.
async function validarNovoHorario(vaga, horario, agora, tx) {
    if (horario === undefined) return null;
    const novo = new Date(horario);
    const inicioAtual = new Date(vaga.horario);
    if (novo.getTime() === inicioAtual.getTime()) return null;

    const horasAteInicio = (inicioAtual - agora) / (60 * 60 * 1000);
    if (horasAteInicio < HORAS_MINIMAS_CANCELAMENTO) {
        throw new ErroRegraNegocio(
            `Dia e horário só podem mudar com no mínimo ${HORAS_MINIMAS_CANCELAMENTO}h de antecedência do início. Local, lugares e assunto ainda podem mudar.`
        );
    }
    if (novo <= agora) {
        const mensagem = 'Escolha um dia e horário que ainda não passaram.';
        throw new ErroValidacao(mensagem, { horario: mensagem });
    }
    const conflito = await monitoriaRepository.buscarOutraAtivaNoHorario(
        vaga.id_monitor,
        novo,
        vaga.id,
        tx
    );
    if (conflito) {
        throw new ErroConflito('Você já tem uma vaga ativa neste mesmo horário.');
    }
    return novo;
}

class MonitoriaService {
    async criar(dados) {
        // O monitor não pode ter duas vagas ativas começando no mesmo horário. A tela de criar
        // vaga já avisa; aqui a regra vale também para chamadas diretas à API.
        const conflito = await monitoriaRepository.buscarAtivaDoMonitorNoHorario(
            dados.id_monitor,
            dados.horario
        );
        if (conflito) {
            throw new ErroConflito('Você já tem uma vaga ativa neste mesmo horário.');
        }

        try {
            return await monitoriaRepository.criar(dados);
        } catch (error) {
            // P2003: violação de FK — a disciplina informada no corpo não existe
            if (error.code === 'P2003') {
                throw new ErroValidacao('A disciplina informada não existe.', {
                    id_disciplina: 'A disciplina informada não existe.'
                });
            }
            throw error;
        }
    }

    async listarPorDisciplina(idDisciplina, paginacao) {
        const { dados, total } = await monitoriaRepository.buscarPorDisciplina(
            Number(idDisciplina),
            paginacao
        );

        // Expõe a ocupação sem vazar o _count interno do Prisma
        const monitorias = dados.map(({ _count, ...monitoria }) => ({
            ...monitoria,
            vagas_disponiveis: Math.max(monitoria.capacidade - _count.inscricoes, 0)
        }));

        return { dados: monitorias, total };
    }

    async buscarAgendamentosPorMonitor(monitorId, paginacao) {
        return await monitoriaRepository.buscarAgendamentos(monitorId, paginacao);
    }

    async cancelar(id, monitorId) {
        const monitoria = await monitoriaRepository.buscarPorId(id);
        if (!monitoria) {
            throw new ErroNaoEncontrado('Vaga de monitoria não encontrada.');
        }
        if (monitoria.id_monitor !== monitorId) {
            throw new ErroNaoAutorizado('Você não tem permissão para cancelar esta vaga.');
        }
        validarAntecedenciaCancelamento(monitoria.horario);
        return await monitoriaRepository.cancelar(id);
    }

    // Finalização pelo monitor: marca a vaga como realizada e registra a data/hora de término.
    // A data de término não pode ser anterior ao início (horario) da monitoria.
    async finalizar(id, monitorId, dataFim) {
        if (!Number.isInteger(id)) {
            throw new ErroNaoEncontrado('Vaga de monitoria não encontrada.');
        }

        const monitoria = await monitoriaRepository.buscarPorId(id);
        if (!monitoria) {
            throw new ErroNaoEncontrado('Vaga de monitoria não encontrada.');
        }
        if (monitoria.id_monitor !== monitorId) {
            throw new ErroNaoAutorizado('Você não tem permissão para finalizar esta monitoria.');
        }
        if (monitoria.status === 'cancelada') {
            throw new ErroRegraNegocio('Não é possível finalizar uma monitoria cancelada.');
        }
        if (['realizada', 'concluida'].includes(monitoria.status)) {
            throw new ErroRegraNegocio('Esta monitoria já foi finalizada.');
        }

        const fim = new Date(dataFim);
        if (fim.getTime() < new Date(monitoria.horario).getTime()) {
            const mensagem = 'A data de término não pode ser anterior ao início da monitoria.';
            throw new ErroValidacao(mensagem, { data_fim: mensagem });
        }

        const finalizada = await monitoriaRepository.finalizar(id, monitorId, fim);
        // Outra requisição finalizou ou cancelou a vaga entre a leitura e a escrita
        if (!finalizada) {
            throw new ErroRegraNegocio('Esta monitoria já foi finalizada ou cancelada.');
        }
        return finalizada;
    }
    // Editar vaga (RF-009, RN-010). Só o monitor dono altera uma vaga ativa que ainda não
    // começou. Dia e horário só mudam com 24h ou mais até o início atual; local, lugares e
    // assunto, até o início. Lugares nunca ficam abaixo dos inscritos. Se dia, horário ou local
    // mudarem, os inscritos podem cancelar sem a regra das 24h (ajuste da RN-001).
    async atualizar(id, monitorId, dados) {
        if (!Number.isInteger(id)) {
            throw new ErroNaoEncontrado('Vaga de monitoria não encontrada.');
        }

        const resultado = await monitoriaRepository.emTransacao(async (tx) => {
            const vaga = await monitoriaRepository.bloquearParaEdicao(id, tx);
            if (!vaga) {
                throw new ErroNaoEncontrado('Vaga de monitoria não encontrada.');
            }
            if (vaga.id_monitor !== monitorId) {
                throw new ErroNaoAutorizado('Você não tem permissão para editar esta vaga.');
            }
            if (!['ativa', 'pendente'].includes(vaga.status)) {
                throw new ErroRegraNegocio(
                    'Só é possível editar uma vaga ativa. Esta vaga foi cancelada ou já aconteceu.'
                );
            }

            const agora = new Date();
            const inicioAtual = new Date(vaga.horario);
            if (inicioAtual <= agora) {
                throw new ErroRegraNegocio('Esta vaga já começou e não pode mais ser editada.');
            }

            const alteracoes = {};
            const novoHorario = await validarNovoHorario(vaga, dados.horario, agora, tx);
            if (novoHorario) alteracoes.horario = novoHorario;
            if (dados.local !== undefined && dados.local !== vaga.local) {
                alteracoes.local = dados.local;
            }
            if (dados.descricao !== undefined) alteracoes.descricao = dados.descricao;

            const inscritos = await monitoriaRepository.contarInscritos(id, tx);
            if (dados.capacidade !== undefined) {
                if (dados.capacidade < inscritos) {
                    throw new ErroConflito(
                        `A vaga já tem ${inscritos} inscritos: os lugares não podem ficar abaixo disso.`
                    );
                }
                alteracoes.capacidade = dados.capacidade;
            }

            const monitoria = await monitoriaRepository.atualizar(id, alteracoes, tx);
            const alterouQuandoOuOnde = Boolean(novoHorario || alteracoes.local !== undefined);
            if (alterouQuandoOuOnde && inscritos > 0) {
                await monitoriaRepository.liberarInscricoes(
                    id,
                    agora,
                    {
                        novoHorario,
                        mudouLocal: alteracoes.local !== undefined,
                        antes: { horario: new Date(vaga.horario), local: vaga.local }
                    },
                    tx
                );
            }
            return { monitoria, alterouQuandoOuOnde, inscritos };
        });

        // Sem dados dos alunos no log: só a vaga, o monitor e o que mudou
        logger.info(
            {
                id_monitoria: id,
                id_monitor: monitorId,
                campos: Object.keys(dados),
                liberados: resultado.alterouQuandoOuOnde ? resultado.inscritos : 0
            },
            'Vaga de monitoria editada'
        );
        // O e-mail "vaga alterada" para os inscritos entra com o plano 3 (notificações)
        return resultado;
    }

    async listarPorMonitor(monitorId, paginacao) {
        return await monitoriaRepository.buscarPorMonitor(monitorId, paginacao);
    }
}

module.exports = new MonitoriaService();
