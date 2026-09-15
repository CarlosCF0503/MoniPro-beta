// src/repositories/agendamentoRepository.js

const prisma = require('../config/bancoDeDados');

class AgendamentoRepository {
    async criar(dados, tx = prisma) {
        return await tx.agendamento.create({ data: dados });
    }

    async buscarPorAluno(idAluno, { skip, take } = {}) {
        const where = { id_aluno: parseInt(idAluno) };

        const [dados, total] = await Promise.all([
            prisma.agendamento.findMany({
                where,

                include: {
                    monitoria: {
                        include: {
                            disciplina: true,

                            monitor: { select: { nome_completo: true } }
                        }
                    }
                },

                orderBy: { data_hora: 'desc' },

                skip,

                take
            }),

            prisma.agendamento.count({ where })
        ]);

        return { dados, total };
    }

    async buscarPorId(id) {
        return await prisma.agendamento.findUnique({
            where: { id: parseInt(id) }
        });
    }

    async buscarPorAlunoEMonitoria(idAluno, idMonitoria, tx = prisma) {
        return await tx.agendamento.findFirst({
            where: {
                id_aluno: parseInt(idAluno),

                id_monitoria: parseInt(idMonitoria)
            }
        });
    }

    // Tarefa 23: conta quantos agendamentos já existem para a vaga, usada dentro
    // da transação de agendamentoService.criar para validar o limite de capacidade.
    async contarPorMonitoria(idMonitoria, tx = prisma) {
        return await tx.agendamento.count({
            where: { id_monitoria: parseInt(idMonitoria) }
        });
    }

    async deletar(id) {
        return await prisma.agendamento.delete({
            where: { id: parseInt(id) }
        });
    }

    async concluirEIncrementarPontos(idAgendamento, idAluno) {
        return await prisma.$transaction([
            prisma.agendamento.update({
                where: { id: idAgendamento },

                data: { status: 'concluido' }
            }),

            prisma.usuario.update({
                where: { id: idAluno },

                data: { pontos: { increment: 10 } }
            })
        ]);
    }
}

module.exports = new AgendamentoRepository();
