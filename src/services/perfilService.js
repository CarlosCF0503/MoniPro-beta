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
        const { dados, total } = await agendamentoRepository.buscarPorAluno(idAluno, paginacao);
        // Plano 8: quem está na lista de espera vê a posição (1 = o próximo)
        const naFila = dados.filter((a) => a.status === 'em_espera');
        const posicoes = await agendamentoRepository.posicoesNaFila(naFila);
        const agendamentos = dados.map((a) =>
            a.status === 'em_espera' ? { ...a, posicao_fila: posicoes[a.id] } : a
        );
        return { dados: agendamentos, total };
    }

    async obterMonitorias(idMonitor, paginacao) {
        const { dados, total } = await monitoriaRepository.buscarPorMonitor(idMonitor, paginacao);

        // O perfil do monitor mostra "N de capacidade inscritos" sem vazar o _count interno do
        // Prisma, e quantos estão na lista de espera (plano 8)
        const filas = await monitoriaRepository.contarFilas(dados.map((m) => m.id));
        const monitorias = dados.map(({ _count, ...monitoria }) => ({
            ...monitoria,
            inscritos: _count?.inscricoes ?? 0,
            na_fila: filas[monitoria.id] || 0
        }));

        return { dados: monitorias, total };
    }
}

module.exports = new PerfilService();
