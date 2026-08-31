const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: {},
    monitoria: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    agendamento: { findMany: jest.fn(), count: jest.fn() },
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenMonitor = gerarToken({ id: 10, tipo: 'monitor' });
const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });

const dadosVaga = { id_disciplina: 1, horario: '2026-09-10T14:00:00.000Z', local: 'Sala 12' };

describe('POST /monitorias (Tarefa 21 — controle de acesso na criação de vagas)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 201 quando o token é de um monitor', async () => {
        prisma.monitoria.create.mockResolvedValue({ id: 1, ...dadosVaga, id_monitor: 10 });

        const resposta = await request(app)
            .post('/monitorias')
            .set('Authorization', `Bearer ${tokenMonitor}`)
            .send(dadosVaga);

        expect(resposta.status).toBe(201);
        expect(prisma.monitoria.create).toHaveBeenCalledTimes(1);
    });

    it('retorna 403 quando o token é de um aluno (isMonitor deve bloquear)', async () => {
        const resposta = await request(app)
            .post('/monitorias')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send(dadosVaga);

        expect(resposta.status).toBe(403);
        expect(prisma.monitoria.create).not.toHaveBeenCalled();
    });

    it('retorna 401 quando não há token', async () => {
        const resposta = await request(app).post('/monitorias').send(dadosVaga);

        expect(resposta.status).toBe(401);
        expect(prisma.monitoria.create).not.toHaveBeenCalled();
    });
});

describe('GET /monitorias/:idDisciplina (Tarefa 22 — exigir autenticação na listagem)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 401 quando a requisição não está autenticada', async () => {
        const resposta = await request(app).get('/monitorias/1');

        expect(resposta.status).toBe(401);
        expect(prisma.monitoria.findMany).not.toHaveBeenCalled();
    });

    it('retorna 200 e a lista quando a requisição está autenticada', async () => {
        prisma.monitoria.findMany.mockResolvedValue([{ id: 1, local: 'Sala 12' }]);
        prisma.monitoria.count.mockResolvedValue(1);

        const resposta = await request(app)
            .get('/monitorias/1')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.monitorias).toHaveLength(1);
    });
});

describe('PUT /monitorias/:id/cancelar', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 200 quando o monitor dono da vaga cancela', async () => {
        prisma.monitoria.findUnique.mockResolvedValue({ id: 1, id_monitor: 10, status: 'ativa' });
        prisma.monitoria.update.mockResolvedValue({ id: 1, id_monitor: 10, status: 'cancelada' });

        const resposta = await request(app)
            .put('/monitorias/1/cancelar')
            .set('Authorization', `Bearer ${tokenMonitor}`);

        expect(resposta.status).toBe(200);
        expect(prisma.monitoria.update).toHaveBeenCalledTimes(1);
    });

    it('retorna 403 quando quem tenta cancelar não é o monitor dono da vaga', async () => {
        prisma.monitoria.findUnique.mockResolvedValue({ id: 1, id_monitor: 999, status: 'ativa' });

        const resposta = await request(app)
            .put('/monitorias/1/cancelar')
            .set('Authorization', `Bearer ${tokenMonitor}`);

        expect(resposta.status).toBe(403);
        expect(prisma.monitoria.update).not.toHaveBeenCalled();
    });
});
