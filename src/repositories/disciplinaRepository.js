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

    async listar() {
        return await prisma.disciplina.findMany({
            orderBy: {
                nome: 'asc' // Traz em ordem alfabética (A-Z) 
            }
        });
    }
}
module.exports = new DisciplinaRepository();