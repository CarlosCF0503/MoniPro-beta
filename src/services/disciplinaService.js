// src/services/disciplinaService.js
const disciplinaRepository = require('../repositories/disciplinaRepository');
const { ErroValidacao, ErroConflito } = require('../utils/erros');

class DisciplinaService {
    async criar(dados) {
        if (!dados.nome) {
            throw new ErroValidacao('O nome da disciplina é obrigatório.', {
                nome: 'O nome da disciplina é obrigatório.'
            });
        }
        try {
            return await disciplinaRepository.criar(dados);
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ErroConflito('Já existe uma disciplina com esse nome.');
            }
            throw error;
        }
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