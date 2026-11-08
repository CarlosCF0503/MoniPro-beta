const agendamentoRepository = require('../repositories/agendamentoRepository');
const { validarAntecedenciaCancelamento } = require('../utils/validarAntecedencia');
const { validarJanelaConfirmacao } = require('../utils/regrasConclusao');
const {
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

            // Impede agendamento duplicado para a mesma monitoria
            const jaExiste = await agendamentoRepository.buscarPorAlunoEMonitoria(
                dados.id_aluno,
                dados.id_monitoria,
                tx
            );
            if (jaExiste) {
                throw new ErroRegraNegocio('Você já está inscrito nesta monitoria.');
            }

            const ocupadas = await agendamentoRepository.contarOcupadas(dados.id_monitoria, tx);
            if (ocupadas >= monitoria.capacidade) {
                // Vaga lotada: conflito de estado, não erro de validação da requisição
                throw new ErroConflito('Esta vaga de monitoria está lotada.');
            }

            // Tarefa 31: a data/hora do agendamento é sempre a da vaga gravada no banco,
            // nunca a enviada pelo cliente
            return await agendamentoRepository.criar(
                { ...dados, data_hora: monitoria.horario },
                tx
            );
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
        validarAntecedenciaCancelamento(agendamento.data_hora);
        return await agendamentoRepository.deletar(id);
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
            if (concluiu)
                await agendamentoRepository.creditarPontos(ag.id_monitor, ag.id_aluno, tx);
            return { agendamento, concluiu };
        });
    }
}

module.exports = new AgendamentoService();
