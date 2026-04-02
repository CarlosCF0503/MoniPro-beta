// src/repositories/disciplinaRepository.js
const prisma = require('../config/bancoDeDados');

class DisciplinaRepository {
    // AJUSTE: Novo método para criar a disciplina no banco
    async criar(dados) {
        return await prisma.disciplina.create({
            data: { nome: dados.nome }
        });
    }

    async buscarTodas() {
        return await prisma.disciplina.findMany({ orderBy: { nome: 'asc' } });
    }
}
module.exports = new DisciplinaRepository();