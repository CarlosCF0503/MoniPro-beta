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

    async buscarPorDisciplina(idDisciplina) {
        return await prisma.monitoria.findMany({
            where: {
                id_disciplina: idDisciplina,
                status: 'ativa'
            },
            include: {
                monitor: { select: { nome_completo: true } }
            },
            orderBy: { horario: 'asc' }
        });
    }

    async buscarAgendamentos(monitorId) {
        return await prisma.agendamento.findMany({
            where: {
                monitoria: { id_monitor: monitorId }
            },
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
            orderBy: { data_hora: 'desc' }
        });
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

    async buscarPorMonitor(idMonitor) {
        return await prisma.monitoria.findMany({
            where: { id_monitor: idMonitor },
            include: {
                disciplina: { select: { nome: true } }
            },
            orderBy: { horario: 'desc' }
        });
    }
}

module.exports = new MonitoriaRepository();
