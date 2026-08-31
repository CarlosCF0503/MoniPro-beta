const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: {},
    monitoria: {},
    agendamento: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn()
    }
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });
const tokenOutroAluno = gerarToken({ id: 21, tipo: 'aluno' });

describe('POST /agendamentos', () => {
    beforeEach(() => jest.clearAllMocks());

    it('cria o agendamento e retorna 201 quando não há inscrição duplicada', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1, id_monitoria: 5, id_aluno: 20 });

        const resposta = await request(app)
            .post('/agendamentos')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({ id_monitoria: 5, data_hora: '2026-09-10T14:00:00.000Z' });

        expect(resposta.status).toBe(201);
        expect(prisma.agendamento.create).toHaveBeenCalledTimes(1);
    });

    it('retorna 400 e bloqueia inscrição duplicada na mesma monitoria', async () => {
        prisma.agendamento.findFirst.mockResolvedValue({ id: 1, id_monitoria: 5, id_aluno: 20 });

        const resposta = await request(app)
            .post('/agendamentos')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({ id_monitoria: 5, data_hora: '2026-09-10T14:00:00.000Z' });

        expect(resposta.status).toBe(400);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });

    it('retorna 401 quando não há token', async () => {
        const resposta = await request(app)
            .post('/agendamentos')
            .send({ id_monitoria: 5, data_hora: '2026-09-10T14:00:00.000Z' });

        expect(resposta.status).toBe(401);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });
});

describe('DELETE /agendamentos/:id', () => {
    beforeEach(() => jest.clearAllMocks());

    it('cancela e retorna 200 quando o aluno dono do agendamento cancela', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({ id: 1, id_aluno: 20 });
        prisma.agendamento.delete.mockResolvedValue({ id: 1 });

        const resposta = await request(app)
            .delete('/agendamentos/1')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(prisma.agendamento.delete).toHaveBeenCalledTimes(1);
    });

    it('retorna 403 quando outro aluno tenta cancelar o agendamento', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({ id: 1, id_aluno: 20 });

        const resposta = await request(app)
            .delete('/agendamentos/1')
            .set('Authorization', `Bearer ${tokenOutroAluno}`);

        expect(resposta.status).toBe(403);
        expect(prisma.agendamento.delete).not.toHaveBeenCalled();
    });
});
