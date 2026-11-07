const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { findUnique: jest.fn() },
    monitoria: { findMany: jest.fn(), count: jest.fn() },
    agendamento: {}
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });
const tokenMonitor = gerarToken({ id: 30, tipo: 'monitor' });

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

describe('GET /perfil/monitorias', () => {
    beforeEach(() => jest.clearAllMocks());

    it('devolve quantos alunos estão inscritos em cada vaga, sem expor o _count do Prisma', async () => {
        prisma.monitoria.findMany.mockResolvedValue([
            {
                id: 7,
                horario: '2026-11-10T17:00:00.000Z',
                local: 'Sala 204',
                status: 'ativa',
                capacidade: 3,
                disciplina: { nome: 'Cálculo I' },
                _count: { inscricoes: 2 }
            }
        ]);
        prisma.monitoria.count.mockResolvedValue(1);

        const resposta = await request(app)
            .get('/perfil/monitorias')
            .set('Authorization', `Bearer ${tokenMonitor}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.monitorias[0].inscritos).toBe(2);
        expect(resposta.body.monitorias[0].capacidade).toBe(3);
        expect(resposta.body.monitorias[0]._count).toBeUndefined();
    });

    it('conta só inscrições que ocupam vaga (não canceladas) e filtra pelo monitor do token', async () => {
        prisma.monitoria.findMany.mockResolvedValue([]);
        prisma.monitoria.count.mockResolvedValue(0);

        await request(app).get('/perfil/monitorias').set('Authorization', `Bearer ${tokenMonitor}`);

        const consulta = prisma.monitoria.findMany.mock.calls[0][0];
        expect(consulta.where).toEqual({ id_monitor: 30 });
        expect(consulta.include._count.select.inscricoes).toEqual({
            where: { status: { not: 'cancelado' } }
        });
    });

    it('aceita limit=100 para o perfil listar todas as vagas de uma vez', async () => {
        prisma.monitoria.findMany.mockResolvedValue([]);
        prisma.monitoria.count.mockResolvedValue(0);

        const resposta = await request(app)
            .get('/perfil/monitorias?limit=100')
            .set('Authorization', `Bearer ${tokenMonitor}`);

        expect(prisma.monitoria.findMany.mock.calls[0][0].take).toBe(100);
        expect(resposta.body.paginacao.limit).toBe(100);
    });
});
