// src/services/monitoriaService.js
const monitoriaRepository = require('../repositories/monitoriaRepository');
const { validarAntecedenciaCancelamento } = require('../utils/validarAntecedencia');
const {
    ErroValidacao,
    ErroRegraNegocio,
    ErroNaoAutorizado,
    ErroNaoEncontrado
} = require('../utils/erros');

class MonitoriaService {
    async criar(dados) {
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
    async listarPorMonitor(monitorId, paginacao) {
        return await monitoriaRepository.buscarPorMonitor(monitorId, paginacao);
    }
}

module.exports = new MonitoriaService();
