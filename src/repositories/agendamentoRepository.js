// src/repositories/agendamentoRepository.js
const prisma = require('../config/bancoDeDados');

class AgendamentoRepository {
    async criar(dados) {
        return await prisma.agendamento.create({ data: dados });
    }

    async buscarPorAluno(idAluno) {
        return await prisma.agendamento.findMany({
            where: { id_aluno: parseInt(idAluno) },
            include: {
                monitoria: {
                    include: {
                        disciplina: true,
                        monitor: { select: { nome_completo: true } }
                    }
                }
            },
            orderBy: { data_hora: 'desc' }
        });
    }

    async buscarPorId(id) {
        return await prisma.agendamento.findUnique({
            where: { id: parseInt(id) }
        });
    }

    async buscarPorAlunoEMonitoria(idAluno, idMonitoria) {
        return await prisma.agendamento.findFirst({
            where: {
                id_aluno:     parseInt(idAluno),
                id_monitoria: parseInt(idMonitoria)
            }
        });
    }

    async deletar(id) {
        return await prisma.agendamento.delete({
            where: { id: parseInt(id) }
        });
    }
}

module.exports = new AgendamentoRepository();
