const request = require('supertest');

jest.mock('../src/config/bancoDeDados', () => ({
    $queryRaw: jest.fn()
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');
const { comTempoLimite } = require('../src/controllers/saudeController');

describe('GET /saude (Tarefa 17)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 200 quando o banco responde', async () => {
        prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

        const resposta = await request(app).get('/saude');

        expect(resposta.status).toBe(200);
        expect(resposta.body).toMatchObject({ status: 'ok', banco: 'ok' });
        expect(typeof resposta.body.latencia_banco_ms).toBe('number');
        expect(resposta.headers['cache-control']).toBe('no-store');
    });

    it('retorna 503 sem expor detalhes quando o banco falha', async () => {
        prisma.$queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

        const resposta = await request(app).get('/saude');

        expect(resposta.status).toBe(503);
        expect(resposta.body).toEqual({ status: 'erro', banco: 'indisponivel' });
        expect(JSON.stringify(resposta.body)).not.toMatch(/ECONNREFUSED|5432/);
    });

    it('rejeita quando o banco não responde dentro do tempo limite', async () => {
        const nuncaResolve = new Promise(() => {});

        await expect(comTempoLimite(nuncaResolve, 20)).rejects.toThrow(/tempo limite/);
    });

    it('também passa pelo limite geral de requisições (não martela o banco sem limite)', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        const resposta = await request(app).get('/saude');

        expect(resposta.headers['ratelimit-limit']).toBe('120');
    });
});
