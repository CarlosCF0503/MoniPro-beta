// Plano 9 (RF-014): série semanal na API, com o Prisma simulado (os mesmos casos rodam contra o
// Postgres em tests/integracao/recorrentes.int.test.js).
const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/services/notificacaoService');
jest.mock('../src/config/bancoDeDados', () => ({
    usuario: {},
    monitoria: {
        create: jest.fn(),
        createManyAndReturn: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
    },
    agendamento: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn()
}));

const prisma = require('../src/config/bancoDeDados');
const notificacaoService = require('../src/services/notificacaoService');
const app = require('../src/app');

const DIA = 24 * 60 * 60 * 1000;
const cookie = (id, tipo = 'monitor') => `monipro_sessao=${gerarToken({ id, tipo })}`;
// Meio-dia em Brasília daqui a 10 dias, para a série não cruzar a meia-noite do campus
const inicio = (() => {
    const d = new Date(Date.now() + 10 * DIA);
    d.setUTCHours(15, 0, 0, 0);
    return d;
})();
const diaCampus = (d) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
const vagaSerie = (extra) => ({
    id_disciplina: 1,
    horario: inicio.toISOString(),
    local: 'Sala 12',
    repeticao: { frequencia: 'semanal', ate: diaCampus(new Date(inicio.getTime() + 21 * DIA)) },
    ...extra
});

beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.monitoria.createManyAndReturn.mockImplementation(({ data }) =>
        Promise.resolve(data.map((d, i) => ({ id: 100 + i, ...d })))
    );
});

describe('POST /monitorias com repeticao', () => {
    it('cria uma vaga por semana com o mesmo id_serie e pula a data ocupada', async () => {
        const ocupada = new Date(inicio.getTime() + 7 * DIA);
        prisma.monitoria.findMany.mockResolvedValue([{ horario: ocupada }]);

        const r = await request(app)
            .post('/monitorias')
            .set('Cookie', cookie(10))
            .send(vagaSerie());

        expect(r.status).toBe(201);
        expect(r.body.criadas).toHaveLength(3);
        expect(r.body.puladas).toEqual([ocupada.toISOString()]);
        expect(r.body.monitoria.id).toBe(100);
        const { data } = prisma.monitoria.createManyAndReturn.mock.calls[0][0];
        expect(new Set(data.map((d) => d.id_serie)).size).toBe(1);
        expect(data[0]).toMatchObject({ id_monitor: 10, local: 'Sala 12', status: 'ativa' });
        expect(prisma.monitoria.create).not.toHaveBeenCalled();
    });

    it('409 quando o monitor já tem vaga em todas as datas', async () => {
        prisma.monitoria.findMany.mockResolvedValue(
            [0, 7, 14, 21].map((d) => ({ horario: new Date(inicio.getTime() + d * DIA) }))
        );

        const r = await request(app)
            .post('/monitorias')
            .set('Cookie', cookie(10))
            .send(vagaSerie());

        expect(r.status).toBe(409);
        expect(prisma.monitoria.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('disciplina inexistente (P2003) vira erro de validação', async () => {
        prisma.monitoria.findMany.mockResolvedValue([]);
        prisma.monitoria.createManyAndReturn.mockRejectedValue(
            Object.assign(new Error('fk'), { code: 'P2003' })
        );

        const r = await request(app)
            .post('/monitorias')
            .set('Cookie', cookie(10))
            .send(vagaSerie());

        expect(r.status).toBe(400);
        expect(JSON.stringify(r.body)).toMatch(/disciplina informada não existe/);
    });

    it('outro erro do banco não é engolido', async () => {
        prisma.monitoria.findMany.mockResolvedValue([]);
        prisma.monitoria.createManyAndReturn.mockRejectedValue(new Error('caiu'));

        const r = await request(app)
            .post('/monitorias')
            .set('Cookie', cookie(10))
            .send(vagaSerie());

        expect(r.status).toBe(500);
    });

    it('400 quando a data final passa de 16 vagas ou vem antes do dia', async () => {
        const longe = diaCampus(new Date(inicio.getTime() + 16 * 7 * DIA));
        const antes = diaCampus(new Date(inicio.getTime() - DIA));
        for (const ate of [longe, antes]) {
            const r = await request(app)
                .post('/monitorias')
                .set('Cookie', cookie(10))
                .send(vagaSerie({ repeticao: { frequencia: 'semanal', ate } }));
            expect(r.status).toBe(400);
        }
        expect(prisma.monitoria.findMany).not.toHaveBeenCalled();
    });
});

describe('PUT /monitorias/:id/cancelar-proximas', () => {
    const agora = Date.now();
    const vaga = (extra) => ({
        id: 1,
        id_monitor: 10,
        status: 'ativa',
        id_serie: 's1',
        horario: new Date(agora + 3 * DIA),
        ...extra
    });
    const put = (id = 1, quem = 10) =>
        request(app).put(`/monitorias/${id}/cancelar-proximas`).set('Cookie', cookie(quem));

    it('cancela esta e as próximas, avisa e encerra a fila de cada uma', async () => {
        prisma.monitoria.findUnique.mockResolvedValue(vaga());
        prisma.monitoria.findMany.mockResolvedValue([
            { id: 1, horario: new Date(agora + 3 * DIA) },
            { id: 2, horario: new Date(agora + 10 * DIA) }
        ]);

        const r = await put();

        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ canceladas: [1, 2], mantidas: [] });
        expect(r.body.mensagem).toBe('2 vagas canceladas.');
        expect(prisma.monitoria.update).toHaveBeenCalledTimes(2);
        expect(notificacaoService.avisarCancelamento).toHaveBeenCalledTimes(2);
        expect(prisma.agendamento.updateMany).toHaveBeenCalledTimes(2);
        expect(prisma.monitoria.findMany.mock.calls[0][0].where).toMatchObject({
            id_serie: 's1',
            status: 'ativa'
        });
    });

    it('a vaga a menos de 24h fica; mensagem no singular', async () => {
        prisma.monitoria.findUnique.mockResolvedValue(vaga({ horario: new Date(agora + DIA / 2) }));
        prisma.monitoria.findMany.mockResolvedValue([
            { id: 1, horario: new Date(agora + DIA / 2) },
            { id: 2, horario: new Date(agora + 7.5 * DIA) }
        ]);

        const r = await put();

        expect(r.status).toBe(200);
        expect(r.body.canceladas).toEqual([2]);
        expect(r.body.mantidas.map((v) => v.id)).toEqual([1]);
        expect(r.body.mensagem).toBe('1 vaga cancelada.');
    });

    it('400 (RN-001) quando nenhuma está a 24h ou mais', async () => {
        const perto = new Date(agora + DIA / 2);
        prisma.monitoria.findUnique.mockResolvedValue(vaga({ horario: perto }));
        prisma.monitoria.findMany.mockResolvedValue([{ id: 1, horario: perto }]);

        const r = await put();

        expect(r.status).toBe(400);
        expect(r.body.erro).toMatch(/24h/);
        expect(prisma.monitoria.update).not.toHaveBeenCalled();
    });

    it.each([
        ['vaga inexistente', null, 10, 404],
        ['vaga de outro monitor', vaga({ id_monitor: 99 }), 10, 403],
        ['vaga avulsa', vaga({ id_serie: null }), 10, 400],
        ['vaga já cancelada', vaga({ status: 'cancelada' }), 10, 400]
    ])('%s → %i', async (_caso, achada, quem, status) => {
        prisma.monitoria.findUnique.mockResolvedValue(achada);

        const r = await put(1, quem);

        expect(r.status).toBe(status);
        expect(prisma.monitoria.update).not.toHaveBeenCalled();
    });

    it('aluno não acessa a rota', async () => {
        const r = await request(app)
            .put('/monitorias/1/cancelar-proximas')
            .set('Cookie', cookie(20, 'aluno'));
        expect(r.status).toBe(403);
    });
});
