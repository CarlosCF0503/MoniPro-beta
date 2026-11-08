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

    // Só id, nome e pontos: o ranking é visto por qualquer usuário logado e não pode
    // expor e-mail nem matrícula. Empate em pontos é desfeito pelo nome.
    async buscarRankingPorDisciplina(idDisciplina) {
        return await prisma.usuario.findMany({
            where: {
                tipo_usuario: 'aluno',
                meus_agendamentos: {
                    some: {
                        status: 'concluido',
                        monitoria: { id_disciplina: idDisciplina }
                    }
                }
            },
            select: {
                id: true,
                nome_completo: true,
                pontos: true
            },
            orderBy: [{ pontos: 'desc' }, { nome_completo: 'asc' }],
            take: 10
        });
    }
}

module.exports = new DisciplinaRepository();
