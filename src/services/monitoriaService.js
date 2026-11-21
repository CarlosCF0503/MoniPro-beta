// src/services/monitoriaService.js
const monitoriaRepository = require('../repositories/monitoriaRepository');
const notificacaoService = require('./notificacaoService');
const listaEsperaService = require('./listaEsperaService');
const agendamentoRepository = require('../repositories/agendamentoRepository');
const { tamanhoMaximoFila } = require('../config/listaEspera');
const { LOCAL_ONLINE } = require('../schemas/monitoriaSchemas');
const {
    validarAntecedenciaCancelamento,
    HORAS_MINIMAS_CANCELAMENTO
} = require('../utils/validarAntecedencia');
const logger = require('../utils/logger');
const { randomUUID } = require('crypto');
const { gerarOcorrencias } = require('../utils/recorrencia');
const { MINUTOS_MAX_SESSAO, MINUTOS_TOLERANCIA_RELOGIO } = require('../utils/regrasConclusao');
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

// Plano 11: presencial ↔ on-line e o link da sala. Na on-line o local é sempre "On-line" e o
// link é obrigatório; na presencial não há link e o local precisa ser informado ao voltar dela.
function definirModalidade(vaga, dados, alteracoes) {
    const modalidade = dados.modalidade ?? vaga.modalidade;
    if (modalidade === 'online') {
        const link = dados.link ?? vaga.link;
        if (!link) {
            throw new ErroValidacao('Informe o link da sala.', {
                link: 'Informe o link da sala.'
            });
        }
        if (vaga.modalidade !== 'online') alteracoes.modalidade = 'online';
        if (link !== vaga.link) alteracoes.link = link;
        if (vaga.local !== LOCAL_ONLINE) alteracoes.local = LOCAL_ONLINE;
        else delete alteracoes.local;
        return;
    }
    if (dados.link !== undefined) {
        throw new ErroValidacao('Vaga presencial não tem link de sala.', {
            link: 'Vaga presencial não tem link de sala.'
        });
    }
    if (vaga.modalidade === 'online') {
        if (!dados.local || dados.local === LOCAL_ONLINE) {
            throw new ErroValidacao('Informe o local da monitoria presencial.', {
                local: 'Informe o local da monitoria presencial.'
            });
        }
        alteracoes.modalidade = 'presencial';
        alteracoes.link = null;
    }
}

class MonitoriaService {
    // Plano 9 (RF-014): vaga semanal. Cada data vira uma vaga independente com o mesmo id_serie;
    // as datas em que o monitor já tem vaga ativa no mesmo horário são puladas.
    async criarSerie({ repeticao, ...dados }) {
        const horarios = gerarOcorrencias(new Date(dados.horario), repeticao.ate);
        const ocupados = new Set(
            (await monitoriaRepository.horariosOcupadosDoMonitor(dados.id_monitor, horarios)).map(
                (h) => new Date(h).getTime()
            )
        );
        const livres = horarios.filter((h) => !ocupados.has(h.getTime()));
        const puladas = horarios.filter((h) => ocupados.has(h.getTime()));
        if (!livres.length) {
            throw new ErroConflito('Você já tem vaga ativa em todos esses horários.');
        }
        try {
            const criadas = await monitoriaRepository.criarSerie(dados, livres, randomUUID());
            return { criadas, puladas };
        } catch (error) {
            if (error.code === 'P2003') {
                throw new ErroValidacao('A disciplina informada não existe.', {
                    id_disciplina: 'A disciplina informada não existe.'
                });
            }
            throw error;
        }
    }

    // Plano 9: cancela esta vaga e as próximas da mesma série. As que começam em menos de 24h
    // ficam (RN-001) e voltam em `mantidas`; inscritos e fila de cada cancelada são avisados
    // como no cancelamento comum.
    async cancelarProximas(id, monitorId, agora = new Date()) {
        const vaga = await monitoriaRepository.buscarPorId(id);
        if (!vaga) throw new ErroNaoEncontrado('Vaga de monitoria não encontrada.');
        if (vaga.id_monitor !== monitorId) {
            throw new ErroNaoAutorizado('Você não tem permissão para cancelar esta vaga.');
        }
        if (!vaga.id_serie) throw new ErroValidacao('Esta vaga não se repete.');
        if (vaga.status !== 'ativa') throw new ErroValidacao('Esta vaga não está mais ativa.');

        const serie = await monitoriaRepository.buscarDaSerieAPartirDe(vaga.id_serie, vaga.horario);
        const limite = agora.getTime() + HORAS_MINIMAS_CANCELAMENTO * 60 * 60 * 1000;
        const canceladas = serie.filter((v) => new Date(v.horario).getTime() >= limite);
        const mantidas = serie.filter((v) => new Date(v.horario).getTime() < limite);
        if (!canceladas.length) validarAntecedenciaCancelamento(vaga.horario);

        await monitoriaRepository.emTransacao(async (tx) => {
            for (const v of canceladas) {
                await monitoriaRepository.cancelar(v.id, tx);
                await notificacaoService.avisarCancelamento(v.id, tx);
                await agendamentoRepository.encerrarFila(v.id, tx);
            }
        });
        logger.info(
            { id_serie: vaga.id_serie, canceladas: canceladas.length, mantidas: mantidas.length },
            'série de vagas cancelada a partir de uma data'
        );
        return { canceladas: canceladas.map((v) => v.id), mantidas };
    }

    async criar(dados) {
        if (dados.repeticao) return await this.criarSerie(dados);
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

    // Plano 13: filtros opcionais { periodo, monitor, livres } (já validados no controller)
    async listarPorDisciplina(idDisciplina, paginacao, filtros = {}) {
        const { dados, total } = await monitoriaRepository.buscarPorDisciplina(
            Number(idDisciplina),
            paginacao,
            filtros
        );

        // Expõe a ocupação sem vazar o _count interno do Prisma. Plano 8: o tamanho da lista de
        // espera e se ela ainda aceita gente, para a tela oferecer a fila nas vagas lotadas
        const filas = await monitoriaRepository.contarFilas(dados.map((m) => m.id));
        const monitorias = dados.map(({ _count, ...monitoria }) => {
            const naFila = filas[monitoria.id] || 0;
            return {
                ...monitoria,
                vagas_disponiveis: Math.max(monitoria.capacidade - _count.inscricoes, 0),
                na_fila: naFila,
                fila_cheia: naFila >= tamanhoMaximoFila(monitoria.capacidade)
            };
        });

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
        // Plano 3: cada inscrito recebe o e-mail "vaga cancelada"; o aviso entra na fila junto
        // com o cancelamento
        return await monitoriaRepository.emTransacao(async (tx) => {
            const cancelada = await monitoriaRepository.cancelar(id, tx);
            await notificacaoService.avisarCancelamento(id, tx);
            // Plano 8: quem estava na lista de espera também foi avisado e sai da fila
            await agendamentoRepository.encerrarFila(id, tx);
            return cancelada;
        });
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
        const inicio = new Date(monitoria.horario);
        if (fim.getTime() < inicio.getTime()) {
            const mensagem = 'A data de término não pode ser anterior ao início da monitoria.';
            throw new ErroValidacao(mensagem, { data_fim: mensagem });
        }
        // Certificados (PR 1): o término é registrado depois que acontece, e uma sessão vale
        // no máximo 4h. Sem esses limites, um término dias depois do início inflaria as horas.
        if (fim.getTime() > Date.now() + MINUTOS_TOLERANCIA_RELOGIO * 60000) {
            const mensagem =
                'O término não pode estar no futuro. Finalize depois que a monitoria acabar.';
            throw new ErroValidacao(mensagem, { data_fim: mensagem });
        }
        if (fim.getTime() - inicio.getTime() > MINUTOS_MAX_SESSAO * 60000) {
            const mensagem = `Uma monitoria pode durar no máximo ${MINUTOS_MAX_SESSAO / 60}h. Escolha um término até ${MINUTOS_MAX_SESSAO / 60}h depois do início.`;
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
            definirModalidade(vaga, dados, alteracoes);
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
            // Plano 11: trocar a modalidade ou o link da sala conta como mudar o local
            const alterouQuandoOuOnde = Boolean(
                novoHorario ||
                alteracoes.local !== undefined ||
                alteracoes.link !== undefined ||
                alteracoes.modalidade !== undefined
            );
            // Plano 8: quem está na fila também acompanha a mudança e recebe o aviso
            const naFila = await agendamentoRepository.contarFila(id, tx);
            if (alterouQuandoOuOnde && inscritos + naFila > 0) {
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
                // Plano 3: e-mail "vaga alterada" para cada inscrito, com o antes e o depois
                await notificacaoService.avisarAlteracao(
                    id,
                    { horario: new Date(vaga.horario), local: vaga.local, link: vaga.link },
                    agora,
                    tx
                );
            }
            // Plano 8: lugares a mais vão para os primeiros da fila, na mesma transação
            const promovidos =
                naFila > 0 && alteracoes.capacidade > inscritos
                    ? await listaEsperaService.promover(id, tx, agora)
                    : [];
            return { monitoria, alterouQuandoOuOnde, inscritos, promovidos: promovidos.length };
        });

        // Sem dados dos alunos no log: só a vaga, o monitor e o que mudou
        logger.info(
            {
                id_monitoria: id,
                id_monitor: monitorId,
                campos: Object.keys(dados),
                liberados: resultado.alterouQuandoOuOnde ? resultado.inscritos : 0,
                promovidos_da_fila: resultado.promovidos
            },
            'Vaga de monitoria editada'
        );
        return resultado;
    }

    async listarPorMonitor(monitorId, paginacao) {
        return await monitoriaRepository.buscarPorMonitor(monitorId, paginacao);
    }
}

module.exports = new MonitoriaService();
