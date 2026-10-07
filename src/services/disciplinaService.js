// src/services/disciplinaService.js
const disciplinaRepository = require('../repositories/disciplinaRepository');

class DisciplinaService {
    async criar(dados) {
        if (!dados.nome) {
            throw new Error('O nome da disciplina é obrigatório.');
        }
        return await disciplinaRepository.criar(dados);
    }

    async listar() {
        return await disciplinaRepository.buscarTodas();
    }

    // NOVA PONTE: Intermediário para buscar o ranking
    async obterRanking(idDisciplina) {
        if (!idDisciplina || isNaN(idDisciplina)) {
            throw new Error('ID de disciplina inválido.');
        }
        return await disciplinaRepository.buscarRankingPorDisciplina(idDisciplina);
    }
}
module.exports = new DisciplinaService();