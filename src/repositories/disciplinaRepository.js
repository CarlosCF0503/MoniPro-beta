const prisma = require('../config/bancoDeDados');

class DisciplinaRepository {
    async criar(dados) {
        return await prisma.disciplina.create({
            data: { nome: dados.nome }
        });
    }

    async buscarTodas() {
        return await prisma.disciplina.findMany({ orderBy: { nome: 'asc' } });
    }

    async buscarPorId(id) {
        return await prisma.disciplina.findUnique({ where: { id }, select: { id: true } });
    }

    // Comparação sem diferenciar maiúsculas/minúsculas
    async buscarPorNome(nome) {
        return await prisma.disciplina.findFirst({
            where: { nome: { equals: nome, mode: 'insensitive' } },
            select: { id: true, nome: true }
        });
    }
}

module.exports = new DisciplinaRepository();
