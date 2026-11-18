const agendamentoRepository = require('../repositories/agendamentoRepository');
const notificacaoService = require('./notificacaoService');
const listaEsperaService = require('./listaEsperaService');
const pontuacaoService = require('./pontuacaoService');
const { validarAntecedenciaCancelamento } = require('../utils/validarAntecedencia');
const { validarJanelaConfirmacao } = require('../utils/regrasConclusao');
const {
    ErroAplicacao,
    ErroValidacao,
    ErroRegraNegocio,
    ErroNaoAutorizado,
    ErroNaoEncontrado,
    ErroConflito
} = require('../utils/erros');

class AgendamentoService {
    async criar(dados) {
        // Duplicidade e capacidade são verificadas na mesma transação, com a linha da monitoria
        // travada, para que inscrições simultâneas não ultrapassem o limite de vagas.
        return await agendamentoRepository.emTransacao(async (tx) => {
            const monitoria = await agendamentoRepository.bloquearMonitoria(dados.id_monitoria, tx);
            if (!monitoria) {
                // A monitoria vem do corpo da requisição, não da URL: é dado inválido (400), não 404
                throw new ErroValidacao('A monitoria selecionada não foi encontrada.', {
                    id_monitoria: 'A monitoria selecionada não foi encontrada.'
                });
            }

            // Só vagas ativas aceitam inscrição (é o mesmo filtro da listagem de vagas)
            if (monitoria.status !== 'ativa') {
                throw new ErroRegraNegocio(
                    'Esta vaga de monitoria não está aberta para inscrições.'
                );
            }

            // R14: não dá para se inscrever numa vaga que já começou (usa o horário do banco,
            // nunca o enviado pelo cliente)
            if (new Date(monitoria.horario) <= new Date()) {
                throw new ErroAplicacao(
                    'Esta monitoria já começou. Escolha um horário que ainda não aconteceu.',
                    422
                );
            }

            // Impede agendamento duplicado para a mesma monitoria
            const jaExiste = await agendamentoRepository.buscarPorAlunoEMonitoria(
                dados.id_aluno,
                dados.id_monitoria,
                tx
            );
            if (jaExiste && jaExiste.status !== 'em_espera') {
                throw new ErroRegraNegocio('Você já está inscrito nesta monitoria.');
            }

            const ocupadas = await agendamentoRepository.contarOcupadas(dados.id_monitoria, tx);
            if (ocupadas >= monitoria.capacidade) {
                // Vaga lotada: conflito de estado, não erro de validação da requisição. A tela
                // oferece a lista de espera (plano 8).
                throw new ErroConflito(
                    jaExiste
                        ? 'Você já está na lista de espera desta vaga.'
                        : 'Esta vaga de monitoria está lotada.'
                );
            }

            // Plano 8: quem está na fila e encontra um lugar livre (aberto a menos de 2h do
            // início, quando a fila não anda sozinha) se inscreve pela própria entrada da fila
            if (jaExiste) {
                const agendamento = await agendamentoRepository.promover(
                    jaExiste.id,
                    new Date(),
                    false,
                    tx
                );
                await notificacaoService.avisarInscricao(
                    {
                        idAgendamento: agendamento.id,
                        idAluno: dados.id_aluno,
                        idMonitoria: dados.id_monitoria
                    },
                    tx
                );
                return agendamento;
            }

            // Tarefa 31: a data/hora do agendamento é sempre a da vaga gravada no banco,
            // nunca a enviada pelo cliente
            const agendamento = await agendamentoRepository.criar(
                { ...dados, data_hora: monitoria.horario },
                tx
            );
            // Plano 3: e-mail "inscrição confirmada", gravado na fila dentro da mesma transação
            await notificacaoService.avisarInscricao(
                {
                    idAgendamento: agendamento.id,
                    idAluno: dados.id_aluno,
                    idMonitoria: dados.id_monitoria
                },
                tx
            );
            return agendamento;
        });
    }

    async listarPorAluno(idAluno, paginacao) {
        return await agendamentoRepository.buscarPorAluno(idAluno, paginacao);
    }

    async deletar(id, idAluno) {
        const agendamento = await agendamentoRepository.buscarPorId(id);
        if (!agendamento) {
            throw new ErroNaoEncontrado('Agendamento não encontrado.');
        }
        if (agendamento.id_aluno !== idAluno) {
            throw new ErroNaoAutorizado('Você não tem permissão para cancelar este agendamento.');
        }
        // Plano 8: sair da lista de espera vale a qualquer momento e não libera lugar
        if (agendamento.status === 'em_espera') {
            await agendamentoRepository.deletar(id);
            return { saiuDaFila: true, promovidos: 0 };
        }
        // RN-001 com os ajustes do editar vaga e da lista de espera: se a vaga mudou de dia,
        // horário ou local depois da inscrição, ou se o aluno saiu da fila a menos de 24h do
        // início, ele pode cancelar sem as 24h, desde que a sessão ainda não tenha começado
        if (agendamento.liberado_cancelar_em) {
            if (new Date(agendamento.data_hora) <= new Date()) {
                throw new ErroRegraNegocio('Cancelamento não permitido: a monitoria já começou.');
            }
        } else {
            validarAntecedenciaCancelamento(agendamento.data_hora);
        }
        // O lugar liberado vai para o primeiro da fila, na mesma transação e com a vaga travada
        return await agendamentoRepository.emTransacao(async (tx) => {
            await agendamentoRepository.bloquearMonitoria(agendamento.id_monitoria, tx);
            await agendamentoRepository.deletar(id, tx);
            const promovidos = await listaEsperaService.promover(agendamento.id_monitoria, tx);
            return { saiuDaFila: false, promovidos: promovidos.length };
        });
    }

    // P2 (R4): a presença vale quando o aluno e o monitor da vaga confirmam, cada um do seu
    // lado, depois do início da sessão e em até 7 dias. Quem confirma por último conclui o
    // agendamento, e os pontos (D1) entram uma única vez. `lado` é 'aluno' ou 'monitor'.
    async registrarPresenca(id, lado, idUsuario) {
        return await agendamentoRepository.emTransacao(async (tx) => {
            const ag = await agendamentoRepository.bloquearParaPresenca(id, tx);
            if (!ag) {
                throw new ErroNaoEncontrado('Agendamento não encontrado.');
            }
            const ehMonitor = lado === 'monitor';
            if ((ehMonitor ? ag.id_monitor : ag.id_aluno) !== idUsuario) {
                throw new ErroNaoAutorizado(
                    ehMonitor
                        ? 'Só o monitor responsável pela vaga pode confirmar a presença.'
                        : 'Só o aluno inscrito pode confirmar a própria presença.'
                );
            }
            if (ag.status === 'concluido') {
                throw new ErroRegraNegocio(
                    'Esta presença já foi confirmada pelo aluno e pelo monitor.'
                );
            }
            if (ag.status === 'cancelado') {
                throw new ErroRegraNegocio('Não é possível confirmar um agendamento cancelado.');
            }
            if (ag.status === 'em_espera') {
                throw new ErroRegraNegocio(
                    'Quem está na lista de espera não participou da sessão: não há presença a confirmar.'
                );
            }
            // Cancelar a vaga não muda o status das inscrições, então a checagem é feita aqui
            if (ag.status_vaga === 'cancelada') {
                throw new ErroRegraNegocio(
                    'Não é possível confirmar presença numa vaga cancelada.'
                );
            }
            const campo = ehMonitor ? 'presenca_monitor_em' : 'presenca_aluno_em';
            if (ag[campo]) {
                throw new ErroRegraNegocio(
                    ehMonitor
                        ? 'Você já confirmou a presença deste aluno. Falta o aluno confirmar.'
                        : 'Você já confirmou a sua presença. Falta o monitor confirmar.'
                );
            }
            validarJanelaConfirmacao(ag.horario);

            const concluiu = Boolean(ehMonitor ? ag.presenca_aluno_em : ag.presenca_monitor_em);
            const agendamento = await agendamentoRepository.registrarPresenca(
                id,
                campo,
                new Date(),
                concluiu,
                tx
            );
            // Plano 5: os pontos entram como eventos (extrato e ranking por disciplina)
            if (concluiu)
                await pontuacaoService.creditarPresenca(
                    {
                        idAgendamento: ag.id,
                        idMonitor: ag.id_monitor,
                        idAluno: ag.id_aluno,
                        idDisciplina: ag.id_disciplina
                    },
                    tx
                );
            return { agendamento, concluiu };
        });
    }
}

module.exports = new AgendamentoService();
