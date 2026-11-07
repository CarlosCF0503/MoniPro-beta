// src/services/perfilService.js
const perfilRepository = require('../repositories/perfilRepository');
const agendamentoRepository = require('../repositories/agendamentoRepository');
const monitoriaRepository = require('../repositories/monitoriaRepository');
const { ErroNaoEncontrado } = require('../utils/erros');

class PerfilService {
    async obter(id) {
        const perfil = await perfilRepository.buscarPerfilCompleto(id);
        if (!perfil) {
            throw new ErroNaoEncontrado('Perfil não encontrado. Faça login novamente.');
        }
        return perfil;
    }

    async obterAgendamentos(idAluno, paginacao) {
        return await agendamentoRepository.buscarPorAluno(idAluno, paginacao);
    }

    async obterMonitorias(idMonitor, paginacao) {
        const { dados, total } = await monitoriaRepository.buscarPorMonitor(idMonitor, paginacao);

        // O perfil do monitor mostra "N de capacidade inscritos" sem vazar o _count interno do Prisma
        const monitorias = dados.map(({ _count, ...monitoria }) => ({
            ...monitoria,
            inscritos: _count?.inscricoes ?? 0
        }));

        return { dados: monitorias, total };
    }
}

module.exports = new PerfilService();
