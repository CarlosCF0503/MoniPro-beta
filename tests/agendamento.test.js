const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { update: jest.fn() },
    monitoria: {},
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    agendamento: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });
const tokenOutroAluno = gerarToken({ id: 21, tipo: 'aluno' });
const tokenMonitor = gerarToken({ id: 30, tipo: 'monitor' });

const HORARIO_VAGA = new Date('2026-12-01T13:00:00.000Z');

describe('POST /agendamentos', () => {
    const corpo = { id_monitoria: 5, data_hora: '2026-09-10T14:00:00.000Z' };
    const postar = (token = tokenAluno) =>
        request(app).post('/agendamentos').set('Cookie', `monipro_sessao=${token}`).send(corpo);

    beforeEach(() => {
        jest.clearAllMocks();
        // A transação interativa recebe o próprio mock como `tx`
        prisma.$transaction.mockImplementation((fn) => fn(prisma));
        prisma.$queryRaw.mockResolvedValue([
            { capacidade: 1, status: 'ativa', horario: HORARIO_VAGA }
        ]);
        prisma.agendamento.count.mockResolvedValue(0);
    });

    it('cria o agendamento e retorna 201 quando há vaga e não há inscrição duplicada', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1, id_monitoria: 5, id_aluno: 20 });

        const resposta = await postar();

        expect(resposta.status).toBe(201);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.agendamento.create).toHaveBeenCalledTimes(1);
    });

    it('retorna 400 e bloqueia inscrição duplicada na mesma monitoria', async () => {
        prisma.agendamento.findFirst.mockResolvedValue({ id: 1, id_monitoria: 5, id_aluno: 20 });

        const resposta = await postar();

        expect(resposta.status).toBe(400);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });

    it('retorna 409 e não cria quando a vaga está lotada (Tarefa 23)', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.count.mockResolvedValue(1); // capacidade 1, já ocupada por outro aluno

        const resposta = await postar(tokenOutroAluno);

        expect(resposta.status).toBe(409);
        expect(resposta.body.success).toBe(false);
        expect(resposta.body.erro).toMatch(/lotada/i);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });

    it('aceita novas inscrições até atingir a capacidade configurada', async () => {
        prisma.$queryRaw.mockResolvedValue([
            { capacidade: 3, status: 'ativa', horario: HORARIO_VAGA }
        ]);
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 3, id_monitoria: 5, id_aluno: 20 });

        prisma.agendamento.count.mockResolvedValue(2);
        expect((await postar()).status).toBe(201);

        prisma.agendamento.count.mockResolvedValue(3);
        expect((await postar()).status).toBe(409);
    });

    it('não conta agendamentos cancelados como vagas ocupadas', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1 });

        await postar();

        expect(prisma.agendamento.count).toHaveBeenCalledWith({
            where: { id_monitoria: 5, status: { not: 'cancelado' } }
        });
    });

    it('trava a linha da monitoria dentro da transação antes de contar', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1 });

        await postar();

        const sql = prisma.$queryRaw.mock.calls[0][0].join(' ');
        expect(sql).toMatch(/FOR UPDATE/);
        expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
            prisma.agendamento.count.mock.invocationCallOrder[0]
        );
    });

    it('grava o horário da vaga, ignorando a data/hora enviada pelo cliente (Tarefa 31)', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1 });

        const resposta = await postar(); // corpo envia data_hora 2026-09-10T14:00

        expect(resposta.status).toBe(201);
        expect(prisma.agendamento.create.mock.calls[0][0].data.data_hora).toEqual(HORARIO_VAGA);
    });

    it('cria o agendamento mesmo sem data/hora no corpo (Tarefa 31)', async () => {
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.create.mockResolvedValue({ id: 1 });

        const resposta = await request(app)
            .post('/agendamentos')
            .set('Cookie', `monipro_sessao=${tokenAluno}`)
            .send({ id_monitoria: 5 });

        expect(resposta.status).toBe(201);
        expect(prisma.agendamento.create.mock.calls[0][0].data.data_hora).toEqual(HORARIO_VAGA);
    });

    it.each(['cancelada', 'realizada', 'concluida', 'pendente'])(
        'retorna 400 e não cria quando a vaga está com status %s',
        async (status) => {
            prisma.$queryRaw.mockResolvedValue([{ capacidade: 3, status, horario: HORARIO_VAGA }]);
            prisma.agendamento.findFirst.mockResolvedValue(null);

            const resposta = await postar();

            expect(resposta.status).toBe(400);
            expect(resposta.body.erro).toMatch(/não está aberta/i);
            expect(prisma.agendamento.create).not.toHaveBeenCalled();
        }
    );

    it('retorna 400 quando a monitoria não existe', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        const resposta = await postar();

        expect(resposta.status).toBe(400);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });

    it('retorna 401 quando não há token', async () => {
        const resposta = await request(app).post('/agendamentos').send(corpo);

        expect(resposta.status).toBe(401);
        expect(prisma.agendamento.create).not.toHaveBeenCalled();
    });
});

describe('DELETE /agendamentos/:id', () => {
    beforeEach(() => jest.clearAllMocks());

    const em48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const em10h = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

    it('cancela e retorna 200 quando o aluno dono do agendamento cancela', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({ id: 1, id_aluno: 20, data_hora: em48h });
        prisma.agendamento.delete.mockResolvedValue({ id: 1 });

        const resposta = await request(app)
            .delete('/agendamentos/1')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(prisma.agendamento.delete).toHaveBeenCalledTimes(1);
    });

    it('retorna 403 quando outro aluno tenta cancelar o agendamento', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({ id: 1, id_aluno: 20, data_hora: em48h });

        const resposta = await request(app)
            .delete('/agendamentos/1')
            .set('Cookie', `monipro_sessao=${tokenOutroAluno}`);

        expect(resposta.status).toBe(403);
        expect(prisma.agendamento.delete).not.toHaveBeenCalled();
    });

    it('retorna 400 (RN-001) quando faltam menos de 24h para o horário agendado', async () => {
        prisma.agendamento.findUnique.mockResolvedValue({ id: 1, id_aluno: 20, data_hora: em10h });

        const resposta = await request(app)
            .delete('/agendamentos/1')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        expect(resposta.status).toBe(400);
        expect(resposta.body.erro).toMatch(/24h/);
        expect(prisma.agendamento.delete).not.toHaveBeenCalled();
    });
});

describe('Presença confirmada pelos dois lados (P2: aluno e monitor)', () => {
    const HORA = 60 * 60 * 1000;
    const DIA = 24 * HORA;
    const tokenOutroMonitor = gerarToken({ id: 31, tipo: 'monitor' });
    const pedir = (rota, token) => {
        const req = request(app).patch(`/agendamentos/1/${rota}`);
        return token ? req.set('Cookie', `monipro_sessao=${token}`) : req;
    };
    const peloMonitor = (token = tokenMonitor) => pedir('concluir', token);
    const peloAluno = (token = tokenAluno) => pedir('presenca', token);

    // Linha travada: inscrição do aluno 20 numa vaga do monitor 30, que começou há 2 h
    const linha = (extra = {}) => ({
        id: 1,
        id_aluno: 20,
        status: 'pendente',
        presenca_aluno_em: null,
        presenca_monitor_em: null,
        id_monitor: 30,
        horario: new Date(Date.now() - 2 * HORA),
        status_vaga: 'realizada',
        ...extra
    });

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.$transaction.mockImplementation((fn) => fn(prisma));
        prisma.agendamento.update.mockImplementation(async ({ data }) => ({ id: 1, ...data }));
    });

    describe('autorização', () => {
        it('401 sem token nas duas rotas', async () => {
            expect((await peloMonitor(null)).status).toBe(401);
            expect((await peloAluno(null)).status).toBe(401);
            expect(prisma.$queryRaw).not.toHaveBeenCalled();
        });

        it('403 quando um aluno chama a rota do monitor', async () => {
            const resposta = await peloMonitor(tokenAluno);

            expect(resposta.status).toBe(403);
            expect(prisma.$queryRaw).not.toHaveBeenCalled();
        });

        it('403 quando o monitor de outra vaga confirma', async () => {
            prisma.$queryRaw.mockResolvedValue([linha()]);

            const resposta = await peloMonitor(tokenOutroMonitor);

            expect(resposta.status).toBe(403);
            expect(prisma.agendamento.update).not.toHaveBeenCalled();
        });

        it('403 quando outro aluno, ou o monitor, usa a rota do aluno', async () => {
            prisma.$queryRaw.mockResolvedValue([linha()]);

            expect((await peloAluno(tokenOutroAluno)).status).toBe(403);
            expect((await peloAluno(tokenMonitor)).status).toBe(403);
            expect(prisma.agendamento.update).not.toHaveBeenCalled();
        });

        it('404 quando o agendamento não existe', async () => {
            prisma.$queryRaw.mockResolvedValue([]);

            expect((await peloMonitor()).status).toBe(404);
        });
    });

    describe('regras', () => {
        it.each([
            [
                'antes do horário',
                { horario: new Date(Date.now() + 3 * HORA) },
                /depois do horário da sessão \(\d{2}\/\d{2}\/\d{4}/
            ],
            [
                'depois do prazo de 7 dias',
                { horario: new Date(Date.now() - 7 * DIA - HORA) },
                /prazo/
            ],
            ['vaga cancelada', { status_vaga: 'cancelada' }, /vaga cancelada/],
            ['inscrição cancelada', { status: 'cancelado' }, /cancelado/],
            ['já confirmada pelos dois', { status: 'concluido' }, /aluno e pelo monitor/]
        ])('400 %s', async (_nome, extra, mensagem) => {
            prisma.$queryRaw.mockResolvedValue([linha(extra)]);

            const resposta = await peloAluno();

            expect(resposta.status).toBe(400);
            expect(resposta.body.erro).toMatch(mensagem);
            expect(prisma.agendamento.update).not.toHaveBeenCalled();
            expect(prisma.usuario.update).not.toHaveBeenCalled();
        });

        it('aceita no último dia do prazo', async () => {
            prisma.$queryRaw.mockResolvedValue([
                linha({ horario: new Date(Date.now() - 7 * DIA + HORA) })
            ]);

            expect((await peloMonitor()).status).toBe(200);
        });

        it('400 quando o mesmo lado confirma duas vezes', async () => {
            prisma.$queryRaw.mockResolvedValue([linha({ presenca_monitor_em: new Date() })]);
            const doMonitor = await peloMonitor();
            prisma.$queryRaw.mockResolvedValue([linha({ presenca_aluno_em: new Date() })]);
            const doAluno = await peloAluno();

            expect(doMonitor.status).toBe(400);
            expect(doMonitor.body.erro).toMatch(/Falta o aluno/);
            expect(doAluno.status).toBe(400);
            expect(doAluno.body.erro).toMatch(/Falta o monitor/);
            expect(prisma.usuario.update).not.toHaveBeenCalled();
        });
    });

    describe('pontos só com as duas confirmações (D1)', () => {
        it('a primeira confirmação, do monitor, registra sem concluir nem pontuar', async () => {
            prisma.$queryRaw.mockResolvedValue([linha()]);

            const resposta = await peloMonitor();

            expect(resposta.status).toBe(200);
            expect(resposta.body.concluido).toBe(false);
            expect(resposta.body.mensagem).toMatch(/quando o aluno também confirmar/);
            const { data } = prisma.agendamento.update.mock.calls[0][0];
            expect(data.presenca_monitor_em).toBeInstanceOf(Date);
            expect(data.status).toBeUndefined();
            expect(prisma.usuario.update).not.toHaveBeenCalled();
        });

        it('a primeira confirmação, do aluno, registra sem concluir nem pontuar', async () => {
            prisma.$queryRaw.mockResolvedValue([linha()]);

            const resposta = await peloAluno();

            expect(resposta.status).toBe(200);
            expect(resposta.body.concluido).toBe(false);
            expect(resposta.body.mensagem).toMatch(/quando o monitor também confirmar/);
            expect(
                prisma.agendamento.update.mock.calls[0][0].data.presenca_aluno_em
            ).toBeInstanceOf(Date);
            expect(prisma.usuario.update).not.toHaveBeenCalled();
        });

        it('o monitor confirmando depois do aluno conclui e credita +10 e +2', async () => {
            prisma.$queryRaw.mockResolvedValue([linha({ presenca_aluno_em: new Date() })]);

            const resposta = await peloMonitor();

            expect(resposta.status).toBe(200);
            expect(resposta.body.concluido).toBe(true);
            expect(resposta.body.mensagem).toMatch(/\+10 pontos para você e \+2 para o aluno/);
            expect(prisma.agendamento.update.mock.calls[0][0].data.status).toBe('concluido');
            expect(prisma.usuario.update).toHaveBeenCalledTimes(2);
            expect(prisma.usuario.update).toHaveBeenCalledWith({
                where: { id: 30 },
                data: { pontos: { increment: 10 } }
            });
            expect(prisma.usuario.update).toHaveBeenCalledWith({
                where: { id: 20 },
                data: { pontos: { increment: 2 } }
            });
        });

        it('o aluno confirmando depois do monitor também conclui e credita', async () => {
            prisma.$queryRaw.mockResolvedValue([linha({ presenca_monitor_em: new Date() })]);

            const resposta = await peloAluno();

            expect(resposta.body.concluido).toBe(true);
            expect(resposta.body.mensagem).toMatch(/\+2 pontos para você/);
            expect(prisma.usuario.update).toHaveBeenCalledTimes(2);
        });

        it('trava a inscrição na mesma transação da escrita (SELECT ... FOR UPDATE)', async () => {
            prisma.$queryRaw.mockResolvedValue([linha()]);

            await peloAluno();

            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            const sql = prisma.$queryRaw.mock.calls[0][0].join('?');
            expect(sql).toMatch(/FOR UPDATE OF a/);
        });
    });
});
