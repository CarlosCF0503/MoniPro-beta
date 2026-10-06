// src/services/disciplinaService.js
const disciplinaRepository = require('../repositories/disciplinaRepository');
const { ErroValidacao } = require('../utils/erros');

class DisciplinaService {
    // AJUSTE: Intermediário que valida os dados antes de mandar pro banco
    async criar(dados) {
        if (!dados.nome) {
            throw new ErroValidacao('O nome da disciplina é obrigatório.', {
                nome: 'O nome da disciplina é obrigatório.'
            });
        }
        return await disciplinaRepository.criar(dados);
    }

    async listar() {
        return await disciplinaRepository.buscarTodas();
    }
}
module.exports = new DisciplinaService();
