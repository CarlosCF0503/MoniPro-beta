// Certificados, PR 1 (R14): vaga e inscrição só no futuro, e a finalização não aceita término
// no futuro nem sessão com mais de 4h. Sem isso, duas contas combinadas forjariam pontos e horas.
jest.mock('../src/services/notificacaoService');
jest.mock('../src/config/bancoDeDados', () => ({
    // Plano 7: a disciplina das vagas existe e está aprovada
    disciplina: { findUnique: async () => ({ id: 1, status: 'aprovada', id_criador: null }) },
    usuario: { update: jest.fn() },
    monitoria: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn()
    },
    // Plano 12: sem faltas, ninguém está bloqueado
    agendamento: {
        create: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([])
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn()
}));

const request = require('supertest');
const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');
const { gerarToken } = require('./helpers/token');

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const daqui = (ms) => new Date(Date.now() + ms);
const tokenMonitor = gerarToken({ id: 10, tipo: 'monitor' });
const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });

beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
});

describe('Criar vaga (R14)', () => {
    const criar = (horario) =>
        request(app)
            .post('/monitorias')
            .set('Cookie', `monipro_sessao=${tokenMonitor}`)
            .send({ id_disciplina: 1, horario: horario.toISOString(), local: 'Sala 1' });

    beforeEach(() => {
        prisma.monitoria.findFirst.mockResolvedValue(null);
        prisma.monitoria.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }));
    });

    it('horário no passado: 400 e nada é gravado', async () => {
        const resposta = await criar(daqui(-HORA));

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.horario).toBe(
            'Escolha um dia e horário que ainda não passaram.'
        );
        expect(prisma.monitoria.create).not.toHaveBeenCalled();
    });

    it('até 5 minutos atrás ainda passa (diferença de relógio do aparelho)', async () => {
        expect((await criar(daqui(-4 * MIN))).status).toBe(201);
        expect((await criar(daqui(-6 * MIN))).status).toBe(400);
    });

    it('horário no futuro: 201', async () => {
        expect((await criar(daqui(2 * 24 * HORA))).status).toBe(201);
    });
});

describe('Inscrever-se (R14)', () => {
    const inscrever = () =>
        request(app)
            .post('/agendamentos')
            .set('Cookie', `monipro_sessao=${tokenAluno}`)
            .send({ id_monitoria: 5 });

    it('vaga que já começou: 422, mesmo ativa e com lugar livre', async () => {
        prisma.$queryRaw.mockResolvedValue([
            { capacidade: 3, status: 'ativa', horario: daqui(-10 * MIN) }
        ]);

        const resposta = await inscrever();

        expect(resposta.status).toBe(422);
        expect(resposta.body.erro).toMatch(/já começou/);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });

    it('vaga no futuro continua aceitando inscrição', async () => {
        prisma.$queryRaw.mockResolvedValue([
            { capacidade: 3, status: 'ativa', horario: daqui(2 * 24 * HORA) }
        ]);
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.count.mockResolvedValue(0);
        prisma.agendamento.create.mockResolvedValue({ id: 1 });

        expect((await inscrever()).status).toBe(201);
    });
});

describe('Finalizar (teto de 4h e término que já aconteceu)', () => {
    const inicio = daqui(-5 * HORA);
    const finalizar = (fim) =>
        request(app)
            .patch('/monitorias/1/finalizar')
            .set('Cookie', `monipro_sessao=${tokenMonitor}`)
            .send({ data_fim: fim.toISOString() });

    beforeEach(() => {
        prisma.monitoria.findUnique.mockResolvedValue({
            id: 1,
            id_monitor: 10,
            status: 'ativa',
            horario: inicio
        });
        prisma.monitoria.updateMany.mockResolvedValue({ count: 1 });
    });

    it('término no futuro: 400', async () => {
        const resposta = await finalizar(daqui(30 * MIN));

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.data_fim).toMatch(/não pode estar no futuro/);
        expect(prisma.monitoria.updateMany).not.toHaveBeenCalled();
    });

    it('mais de 4h depois do início: 400', async () => {
        const resposta = await finalizar(new Date(inicio.getTime() + 4 * HORA + MIN));

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.data_fim).toMatch(/no máximo 4h/);
    });

    it('exatamente 4h: aceita', async () => {
        expect((await finalizar(new Date(inicio.getTime() + 4 * HORA))).status).toBe(200);
    });
});
