// src/repositories/monitoriaRepository.js
const prisma = require('../config/bancoDeDados');

class MonitoriaRepository {
    async criar(dados) {
        return await prisma.monitoria.create({
            data: {
                id_disciplina: Number(dados.id_disciplina),
                id_monitor:    dados.id_monitor,
                local:         dados.local,
                descricao:     dados.descricao,
                status:        dados.status || 'ativa',
                horario:       dados.horario
            }
        });
    }

    async buscarPorDisciplina(idDisciplina, { skip, take } = {}) {
        const where = {
            id_disciplina: idDisciplina,
            status: 'ativa'
        };

        const [dados, total] = await Promise.all([
            prisma.monitoria.findMany({
                where,
                include: {
                    monitor: { select: { nome_completo: true } }
                },
                orderBy: { horario: 'asc' },
                skip,
                take
            }),
            prisma.monitoria.count({ where })
        ]);

        return { dados, total };
    }

    async buscarAgendamentos(monitorId, { skip, take } = {}) {
        const where = {
            monitoria: { id_monitor: monitorId }
        };

        const [dados, total] = await Promise.all([
            prisma.agendamento.findMany({
                where,
                include: {
                    aluno: {
                        select: { nome_completo: true, email: true, matricula: true }
                    },
                    monitoria: {
                        select: {
                            local: true,
                            horario: true,
                            disciplina: { select: { nome: true } }
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
        return await prisma.monitoria.findUnique({
            where: { id: parseInt(id) }
        });
    }

    async cancelar(id) {
        return await prisma.monitoria.update({
            where: { id: parseInt(id) },
            data:  { status: 'cancelada' }
        });
    }

    async buscarPorMonitor(idMonitor, { skip, take } = {}) {
        const where = { id_monitor: idMonitor };

        const [dados, total] = await Promise.all([
            prisma.monitoria.findMany({
                where,
                include: {
                    disciplina: { select: { nome: true } }
                },
                orderBy: { horario: 'desc' },
                skip,
                take
            }),
            prisma.monitoria.count({ where })
        ]);

        return { dados, total };
    }
}

module.exports = new MonitoriaRepository();
