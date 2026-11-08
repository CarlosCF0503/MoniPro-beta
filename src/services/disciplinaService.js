// src/services/disciplinaService.js
const disciplinaRepository = require('../repositories/disciplinaRepository');
const { ErroConflito, ErroNaoEncontrado } = require('../utils/erros');

class DisciplinaService {
    // O nome chega validado pelo schema. A unicidade no banco diferencia maiúsculas,
    // então a comparação sem diferenciar ("cálculo i" = "Cálculo I") é feita aqui.
    async criar({ nome }) {
        const existente = await disciplinaRepository.buscarPorNome(nome);
        if (existente) {
            throw new ErroConflito(`Já existe uma disciplina com este nome: "${existente.nome}".`);
        }
        return await disciplinaRepository.criar({ nome });
    }

    async listar() {
        return await disciplinaRepository.buscarTodas();
    }

    async obterRanking(idDisciplina) {
        const disciplina = await disciplinaRepository.buscarPorId(idDisciplina);
        if (!disciplina) {
            throw new ErroNaoEncontrado('Disciplina não encontrada.');
        }
        return await disciplinaRepository.buscarRankingPorDisciplina(idDisciplina);
    }
}

module.exports = new DisciplinaService();
