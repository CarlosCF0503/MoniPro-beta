const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    disciplina: {
        create: jest.fn(),
        findMany: jest.fn()
    },
    usuario: { findMany: jest.fn() }
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenMonitor = gerarToken({ id: 10, tipo: 'monitor' });
const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });

describe('GET /disciplinas', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 200 com { success: true, disciplinas }', async () => {
        prisma.disciplina.findMany.mockResolvedValue([{ id: 1, nome: 'Cálculo I' }]);

        const resposta = await request(app)
            .get('/disciplinas')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.success).toBe(true);
        expect(resposta.body.disciplinas).toHaveLength(1);
    });

    it('retorna 500 com { success: false, erro: <string> } quando o banco falha', async () => {
        prisma.disciplina.findMany.mockRejectedValue(new Error('conexão perdida'));

        const resposta = await request(app)
            .get('/disciplinas')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(500);
        expect(resposta.body.success).toBe(false);
        expect(typeof resposta.body.erro).toBe('string');
    });
});

describe('POST /disciplinas', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 201 com { success: true, disciplina } para um monitor', async () => {
        prisma.disciplina.create.mockResolvedValue({ id: 1, nome: 'Cálculo I' });

        const resposta = await request(app)
            .post('/disciplinas')
            .set('Authorization', `Bearer ${tokenMonitor}`)
            .send({ nome: '  Cálculo I  ' });

        expect(resposta.status).toBe(201);
        expect(resposta.body.success).toBe(true);
        expect(resposta.body.disciplina.nome).toBe('Cálculo I');
        // O controller deve enviar o nome já sem espaços nas pontas
        expect(prisma.disciplina.create).toHaveBeenCalledWith({ data: { nome: 'Cálculo I' } });
    });

    it('retorna 400 com erro em string quando o nome não é enviado', async () => {
        const resposta = await request(app)
            .post('/disciplinas')
            .set('Authorization', `Bearer ${tokenMonitor}`)
            .send({});

        expect(resposta.status).toBe(400);
        expect(resposta.body.success).toBe(false);
        expect(typeof resposta.body.erro).toBe('string');
        expect(prisma.disciplina.create).not.toHaveBeenCalled();
    });

    it('retorna 400 com mensagem amigável quando o nome já existe (P2002)', async () => {
        const erroPrisma = Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
            meta: { target: ['nome'] }
        });
        prisma.disciplina.create.mockRejectedValue(erroPrisma);

        const resposta = await request(app)
            .post('/disciplinas')
            .set('Authorization', `Bearer ${tokenMonitor}`)
            .send({ nome: 'Cálculo I' });

        expect(resposta.status).toBe(400);
        expect(resposta.body.success).toBe(false);
        expect(resposta.body.erro).toBe('Já existe uma disciplina com esse nome.');
    });

    it('retorna 403 com { success: false } quando quem cria é um aluno', async () => {
        const resposta = await request(app)
            .post('/disciplinas')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({ nome: 'Cálculo I' });

        expect(resposta.status).toBe(403);
        expect(resposta.body.success).toBe(false);
        expect(typeof resposta.body.erro).toBe('string');
        expect(prisma.disciplina.create).not.toHaveBeenCalled();
    });

    it('retorna 401 com { success: false } quando não há token', async () => {
        const resposta = await request(app).post('/disciplinas').send({ nome: 'Cálculo I' });

        expect(resposta.status).toBe(401);
        expect(resposta.body.success).toBe(false);
        expect(typeof resposta.body.erro).toBe('string');
    });
});

describe('GET /disciplinas/:id/ranking', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 200 com { success: true, ranking }', async () => {
        prisma.usuario.findMany.mockResolvedValue([
            { id: 20, nome_completo: 'Aluna Teste', pontos: 30 }
        ]);

        const resposta = await request(app)
            .get('/disciplinas/1/ranking')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.success).toBe(true);
        expect(resposta.body.ranking).toHaveLength(1);
    });

    it('retorna 400 com erro em string quando o id não é numérico', async () => {
        const resposta = await request(app)
            .get('/disciplinas/abc/ranking')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(400);
        expect(resposta.body.success).toBe(false);
        expect(typeof resposta.body.erro).toBe('string');
        expect(prisma.usuario.findMany).not.toHaveBeenCalled();
    });
});
