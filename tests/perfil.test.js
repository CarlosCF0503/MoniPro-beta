const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { findUnique: jest.fn() },
    monitoria: {},
    agendamento: {}
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });

describe('GET /perfil', () => {
    beforeEach(() => jest.clearAllMocks());

    it('devolve a pontuação do usuário, que a página de perfil exibe (RN-008, CT-11)', async () => {
        prisma.usuario.findUnique.mockResolvedValue({
            id: 20,
            nome_completo: 'Ana Aluna',
            email: 'ana@exemplo.com',
            matricula: 2320041,
            tipo_usuario: 'aluno',
            pontos: 10
        });

        const resposta = await request(app)
            .get('/perfil')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.user.pontos).toBe(10);
        const { select } = prisma.usuario.findUnique.mock.calls[0][0];
        expect(select.pontos).toBe(true);
    });

    it('nunca devolve o hash da senha', async () => {
        prisma.usuario.findUnique.mockResolvedValue({
            id: 20,
            nome_completo: 'Ana Aluna',
            pontos: 0
        });

        await request(app).get('/perfil').set('Authorization', `Bearer ${tokenAluno}`);

        const { select } = prisma.usuario.findUnique.mock.calls[0][0];
        expect(select.senha).toBeUndefined();
    });

    it('retorna 404 quando o usuário do token não existe mais', async () => {
        prisma.usuario.findUnique.mockResolvedValue(null);

        const resposta = await request(app)
            .get('/perfil')
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(404);
    });

    it('retorna 401 sem token', async () => {
        const resposta = await request(app).get('/perfil');

        expect(resposta.status).toBe(401);
        expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });
});
