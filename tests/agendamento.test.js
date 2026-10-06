const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: {},
    monitoria: {},
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
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
    const corpo = { id_monitoria: 5, data_hora: '2026-09-10T14:00:00.000Z' };
    const postar = (token = tokenAluno) =>
        request(app).post('/agendamentos').set('Authorization', `Bearer ${token}`).send(corpo);

    beforeEach(() => {
        jest.clearAllMocks();
        // A transação interativa recebe o próprio mock como `tx`
        prisma.$transaction.mockImplementation((fn) => fn(prisma));
        prisma.$queryRaw.mockResolvedValue([{ capacidade: 1, status: 'ativa' }]);
        prisma.agendamento.count.mockResolvedValue(0);
    });

    it('cria o agendamento e retorna 201 quando há vaga e não há inscrição duplicada', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1, id_monitoria: 5, id_aluno: 20 });

        const resposta = await postar();

        expect(resposta.status).toBe(201);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.agendamento.create).toHaveBeenCalledTimes(1);
    });

    it('retorna 400 e bloqueia inscrição duplicada na mesma monitoria', async () => {
        prisma.agendamento.findFirst.mockResolvedValue({ id: 1, id_monitoria: 5, id_aluno: 20 });

        const resposta = await postar();

        expect(resposta.status).toBe(400);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });

    it('retorna 409 e não cria quando a vaga está lotada (Tarefa 23)', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.count.mockResolvedValue(1); // capacidade 1, já ocupada por outro aluno

        const resposta = await postar(tokenOutroAluno);

        expect(resposta.status).toBe(409);
        expect(resposta.body.success).toBe(false);
        expect(resposta.body.erro).toMatch(/lotada/i);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });

    it('aceita novas inscrições até atingir a capacidade configurada', async () => {
        prisma.$queryRaw.mockResolvedValue([{ capacidade: 3, status: 'ativa' }]);
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 3, id_monitoria: 5, id_aluno: 20 });

        prisma.agendamento.count.mockResolvedValue(2);
        expect((await postar()).status).toBe(201);

        prisma.agendamento.count.mockResolvedValue(3);
        expect((await postar()).status).toBe(409);
    });

    it('não conta agendamentos cancelados como vagas ocupadas', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1 });

        await postar();

        expect(prisma.agendamento.count).toHaveBeenCalledWith({
            where: { id_monitoria: 5, status: { not: 'cancelado' } }
        });
    });

    it('trava a linha da monitoria dentro da transação antes de contar', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1 });

        await postar();

        const sql = prisma.$queryRaw.mock.calls[0][0].join(' ');
        expect(sql).toMatch(/FOR UPDATE/);
        expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
            prisma.agendamento.count.mock.invocationCallOrder[0]
        );
    });

    it('retorna 400 quando a monitoria não existe', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        const resposta = await postar();

        expect(resposta.status).toBe(400);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });

    it('retorna 401 quando não há token', async () => {
        const resposta = await request(app).post('/agendamentos').send(corpo);

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
