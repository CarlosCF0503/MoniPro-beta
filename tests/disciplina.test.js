const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    disciplina: { findMany: jest.fn() }
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });

describe('GET /disciplinas (Tarefa 32)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.disciplina.findMany.mockResolvedValue([{ id: 1, nome: 'Cálculo I' }]);
    });

    it('lista as disciplinas para usuário autenticado', async () => {
        const resposta = await request(app)
            .get('/disciplinas')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.disciplinas).toEqual([{ id: 1, nome: 'Cálculo I' }]);
    });

    it('retorna 401 sem token', async () => {
        const resposta = await request(app).get('/disciplinas');

        expect(resposta.status).toBe(401);
        expect(prisma.disciplina.findMany).not.toHaveBeenCalled();
    });

    it('não expõe mais a rota pública duplicada GET /auth/disciplinas', async () => {
        const resposta = await request(app).get('/auth/disciplinas');

        expect(resposta.status).toBe(404);
        expect(prisma.disciplina.findMany).not.toHaveBeenCalled();
    });
});
