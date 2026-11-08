const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { findUnique: jest.fn() },
    monitoria: { findMany: jest.fn(), count: jest.fn() },
    agendamento: { findMany: jest.fn(), count: jest.fn() }
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
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

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

        await request(app).get('/perfil').set('Cookie', `monipro_sessao=${tokenAluno}`);

        const { select } = prisma.usuario.findUnique.mock.calls[0][0];
        expect(select.senha).toBeUndefined();
    });

    it('retorna 404 quando o usuário do token não existe mais', async () => {
        prisma.usuario.findUnique.mockResolvedValue(null);

        const resposta = await request(app)
            .get('/perfil')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

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
            .set('Cookie', `monipro_sessao=${tokenMonitor}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.monitorias[0].inscritos).toBe(2);
        expect(resposta.body.monitorias[0].capacidade).toBe(3);
        expect(resposta.body.monitorias[0]._count).toBeUndefined();
    });

    it('conta só inscrições que ocupam vaga (não canceladas) e filtra pelo monitor do token', async () => {
        prisma.monitoria.findMany.mockResolvedValue([]);
        prisma.monitoria.count.mockResolvedValue(0);

        await request(app)
            .get('/perfil/monitorias')
            .set('Cookie', `monipro_sessao=${tokenMonitor}`);

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
            .set('Cookie', `monipro_sessao=${tokenMonitor}`);

        expect(prisma.monitoria.findMany.mock.calls[0][0].take).toBe(100);
        expect(resposta.body.paginacao.limit).toBe(100);
    });
});

// RF-004: histórico do usuário. O backend devolve a lista inteira do dono do token, da mais
// recente para a mais antiga; a separação entre "próximas" e "histórico" é feita na tela
// (Monipro_web/JS/perfil/dados.js, coberta em perfilDados.test.js).
describe('GET /perfil/agendamentos (RF-004)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.agendamento.findMany.mockResolvedValue([]);
        prisma.agendamento.count.mockResolvedValue(0);
    });

    it('retorna 401 sem token', async () => {
        const resposta = await request(app).get('/perfil/agendamentos');

        expect(resposta.status).toBe(401);
        expect(prisma.agendamento.findMany).not.toHaveBeenCalled();
    });

    it('filtra pelo aluno do token, nunca por um id vindo da requisição', async () => {
        await request(app)
            .get('/perfil/agendamentos?id_aluno=99')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        const consulta = prisma.agendamento.findMany.mock.calls[0][0];
        expect(consulta.where).toEqual({ id_aluno: 20 });
        expect(prisma.agendamento.count).toHaveBeenCalledWith({ where: { id_aluno: 20 } });
    });

    it('ordena da sessão mais recente para a mais antiga', async () => {
        await request(app)
            .get('/perfil/agendamentos')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        expect(prisma.agendamento.findMany.mock.calls[0][0].orderBy).toEqual({ data_hora: 'desc' });
    });

    it('traz a disciplina e só o nome do monitor, sem e-mail nem matrícula', async () => {
        await request(app)
            .get('/perfil/agendamentos')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        const { include } = prisma.agendamento.findMany.mock.calls[0][0];
        expect(include.monitoria.include.disciplina).toBe(true);
        expect(include.monitoria.include.monitor).toEqual({ select: { nome_completo: true } });
    });

    it('devolve os agendamentos com a paginação', async () => {
        const agendamentos = [
            { id: 2, status: 'pendente', data_hora: '2026-11-20T14:00:00.000Z' },
            { id: 1, status: 'concluido', data_hora: '2026-10-10T14:00:00.000Z' }
        ];
        prisma.agendamento.findMany.mockResolvedValue(agendamentos);
        prisma.agendamento.count.mockResolvedValue(25);

        const resposta = await request(app)
            .get('/perfil/agendamentos?page=2&limit=10')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.agendamentos).toEqual(agendamentos);
        expect(resposta.body.paginacao).toEqual({ page: 2, limit: 10, total: 25, totalPaginas: 3 });
        const consulta = prisma.agendamento.findMany.mock.calls[0][0];
        expect(consulta.skip).toBe(10);
        expect(consulta.take).toBe(10);
    });
});

describe('GET /perfil/monitorias (RF-004)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.monitoria.findMany.mockResolvedValue([]);
        prisma.monitoria.count.mockResolvedValue(0);
    });

    it('retorna 401 sem token', async () => {
        const resposta = await request(app).get('/perfil/monitorias');

        expect(resposta.status).toBe(401);
        expect(prisma.monitoria.findMany).not.toHaveBeenCalled();
    });

    it('ordena da vaga mais recente para a mais antiga', async () => {
        await request(app)
            .get('/perfil/monitorias')
            .set('Cookie', `monipro_sessao=${tokenMonitor}`);

        expect(prisma.monitoria.findMany.mock.calls[0][0].orderBy).toEqual({ horario: 'desc' });
    });
});
