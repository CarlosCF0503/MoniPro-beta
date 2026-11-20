// Plano 13 (RF-017): validação dos filtros de GET /monitorias/:idDisciplina e caminho da
// consulta (sem filtro: Prisma direto; com filtro: SQL dos ids, depois Prisma por id).
const request = require('supertest');
const { Prisma } = require('@prisma/client');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: {},
    monitoria: { findMany: jest.fn(), count: jest.fn() },
    agendamento: { groupBy: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn()
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const cookie = `monipro_sessao=${gerarToken({ id: 20, tipo: 'aluno' })}`;
const listar = (query = '') => request(app).get(`/monitorias/1${query}`).set('Cookie', cookie);
const vaga = (id) => ({ id, local: 'Sala', capacidade: 2, _count: { inscricoes: 0 } });

beforeEach(() => {
    jest.clearAllMocks();
    prisma.monitoria.findMany.mockResolvedValue([vaga(7)]);
    prisma.monitoria.count.mockResolvedValue(1);
});

describe('filtros da listagem — validação', () => {
    it.each([
        ['?periodo=madrugada', 'periodo', /manha, tarde ou noite/],
        ['?monitor=abc', 'monitor', /monitor informado é inválido/],
        ['?monitor=0', 'monitor', /monitor informado é inválido/],
        ['?livres=talvez', 'livres', /livres=1/]
    ])('%s → 400 com o campo %s', async (query, campo, mensagem) => {
        const r = await listar(query);
        expect(r.status).toBe(400);
        expect(r.body.erro).toMatch(mensagem);
        expect(r.body.campos).toHaveProperty(campo);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('sem filtro, nem livres=0, não usa a consulta SQL', async () => {
        expect((await listar()).status).toBe(200);
        expect((await listar('?livres=0')).status).toBe(200);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
        expect(prisma.monitoria.findMany.mock.calls[0][0].where).toEqual({
            id_disciplina: 1,
            status: 'ativa'
        });
    });
});

describe('filtros da listagem — consulta', () => {
    it('com filtro, busca os ids no SQL e só então as vagas, mantendo o total do SQL', async () => {
        prisma.$queryRaw.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([{ total: 41 }]);

        const r = await listar('?periodo=noite&monitor=3&livres=1&limit=20&page=2');

        expect(r.status).toBe(200);
        expect(r.body.paginacao).toMatchObject({ page: 2, total: 41, totalPaginas: 3 });
        const args = prisma.monitoria.findMany.mock.calls[0][0];
        expect(args.where).toEqual({ id: { in: [7] } });
        expect(args.skip).toBeUndefined();
        expect(prisma.monitoria.count).not.toHaveBeenCalled();
        // O SQL recebe os valores como parâmetros, nunca colados no texto
        // ($queryRaw é chamado como template: [textos, ...valores])
        const sql = Prisma.sql(...prisma.$queryRaw.mock.calls[0]);
        expect(sql.values).toEqual(
            expect.arrayContaining([1, 3, 'America/Sao_Paulo', 18, 24, 20, 20])
        );
        expect(sql.sql).not.toMatch(/noite|Sao_Paulo/);
    });

    it('nenhuma vaga combina (ex.: monitor que não existe): lista vazia, não erro', async () => {
        prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

        const r = await listar('?monitor=999999');

        expect(r.status).toBe(200);
        expect(r.body.monitorias).toEqual([]);
        expect(r.body.paginacao.total).toBe(0);
        expect(prisma.monitoria.findMany).not.toHaveBeenCalled();
    });
});
