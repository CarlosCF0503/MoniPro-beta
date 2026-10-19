const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { update: jest.fn() },
    monitoria: {},
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    agendamento: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn()
    }
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });
const tokenOutroAluno = gerarToken({ id: 21, tipo: 'aluno' });
const tokenMonitor = gerarToken({ id: 30, tipo: 'monitor' });

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

    const em48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const em10h = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

    it('cancela e retorna 200 quando o aluno dono do agendamento cancela', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({ id: 1, id_aluno: 20, data_hora: em48h });
        prisma.agendamento.delete.mockResolvedValue({ id: 1 });

        const resposta = await request(app)
            .delete('/agendamentos/1')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(prisma.agendamento.delete).toHaveBeenCalledTimes(1);
    });

    it('retorna 403 quando outro aluno tenta cancelar o agendamento', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({ id: 1, id_aluno: 20, data_hora: em48h });

        const resposta = await request(app)
            .delete('/agendamentos/1')
            .set('Authorization', `Bearer ${tokenOutroAluno}`);

        expect(resposta.status).toBe(403);
        expect(prisma.agendamento.delete).not.toHaveBeenCalled();
    });

    it('retorna 400 (RN-001) quando faltam menos de 24h para o horário agendado', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({ id: 1, id_aluno: 20, data_hora: em10h });

        const resposta = await request(app)
            .delete('/agendamentos/1')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(400);
        expect(resposta.body.erro).toMatch(/24h/);
        expect(prisma.agendamento.delete).not.toHaveBeenCalled();
    });
});

describe('PATCH /agendamentos/:id/concluir', () => {
    const concluir = (token = tokenAluno) =>
        request(app).patch('/agendamentos/1/concluir').set('Authorization', `Bearer ${token}`);

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.$transaction.mockImplementation((fn) => fn(prisma));
    });

    it('conclui o agendamento do próprio aluno e credita os pontos', async () => {
        prisma.agendamento.findUnique
            .mockResolvedValueOnce({ id: 1, id_aluno: 20, status: 'pendente' })
            .mockResolvedValueOnce({ id: 1, id_aluno: 20, status: 'concluido' });
        prisma.agendamento.updateMany.mockResolvedValue({ count: 1 });

        const resposta = await concluir();

        expect(resposta.status).toBe(200);
        expect(resposta.body.agendamento.status).toBe('concluido');
        expect(prisma.usuario.update).toHaveBeenCalledWith({
            where: { id: 20 },
            data: { pontos: { increment: 10 } }
        });
    });

    it('retorna 403 e não credita pontos quando outro aluno tenta concluir', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({
            id: 1,
            id_aluno: 20,
            status: 'pendente'
        });

        const resposta = await concluir(tokenOutroAluno);

        expect(resposta.status).toBe(403);
        expect(prisma.agendamento.updateMany).not.toHaveBeenCalled();
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('retorna 403 quando um monitor tenta concluir o agendamento de um aluno', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({
            id: 1,
            id_aluno: 20,
            status: 'pendente'
        });

        const resposta = await concluir(tokenMonitor);

        expect(resposta.status).toBe(403);
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('retorna 400 ao concluir um agendamento cancelado', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({
            id: 1,
            id_aluno: 20,
            status: 'cancelado'
        });

        const resposta = await concluir();

        expect(resposta.status).toBe(400);
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('não credita pontos duas vezes quando a conclusão concorrente já ocorreu', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({
            id: 1,
            id_aluno: 20,
            status: 'pendente'
        });
        prisma.agendamento.updateMany.mockResolvedValue({ count: 0 });

        const resposta = await concluir();

        expect(resposta.status).toBe(400);
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
});
