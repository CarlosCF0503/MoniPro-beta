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
            orderBy: { pontos: 'desc' },
            take: 10
        });
    }
}

module.exports = new DisciplinaRepository();
