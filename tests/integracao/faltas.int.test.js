// Plano 12 (RN-016), contra o Postgres real: falta marcada pelo monitor, bloqueio e correção.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
const como = async (usuario) => {
    const cookie = await h.cookieDe(usuario);
    return {
        post: (url, corpo = {}) =>
            request(app).post(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo),
        patch: (url) => request(app).patch(url).set('Cookie', cookie).set('Origin', ORIGEM),
        get: (url) => request(app).get(url).set('Cookie', cookie)
    };
};

// Sessão que já aconteceu (há `horasAtras` horas), com o aluno inscrito
async function sessaoPassada(monitor, aluno, horasAtras = 2) {
    const disciplina = await h.criarDisciplina();
    const vaga = await h.criarVaga({ monitor, disciplina, emMs: -horasAtras * h.HORA });
    const ag = await h.inscrever(aluno, vaga);
    return { vaga, ag };
}

describe('Marcar falta', () => {
    it('o monitor marca a falta depois do horário; a presença dele deixa de valer', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const { ag } = await sessaoPassada(monitor, aluno);
        const doMonitor = await como(monitor);

        const r = await doMonitor.patch(`/agendamentos/${ag.id}/ausencia`);

        expect(r.status).toBe(200);
        const gravado = await h.prisma.agendamento.findUnique({ where: { id: ag.id } });
        expect(gravado.ausente_em).toBeInstanceOf(Date);
        expect(gravado.presenca_monitor_em).toBeNull();
        expect((await doMonitor.patch(`/agendamentos/${ag.id}/ausencia`)).status).toBe(409);
    });

    it('antes do horário, de outra vaga ou de presença já concluída: recusado', async () => {
        const monitor = await h.criarUsuario('monitor');
        const outro = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const futura = await h.criarVaga({ monitor, disciplina: await h.criarDisciplina() });
        const agFuturo = await h.inscrever(aluno, futura);
        const { ag } = await sessaoPassada(monitor, aluno);
        const doMonitor = await como(monitor);

        expect((await doMonitor.patch(`/agendamentos/${agFuturo.id}/ausencia`)).status).toBe(400);
        expect((await (await como(outro)).patch(`/agendamentos/${ag.id}/ausencia`)).status).toBe(
            403
        );

        await h.prisma.agendamento.update({ where: { id: ag.id }, data: { status: 'concluido' } });
        expect((await doMonitor.patch(`/agendamentos/${ag.id}/ausencia`)).status).toBe(409);
    });

    it('marcada por engano: o monitor confirma a presença e a falta some', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const { ag } = await sessaoPassada(monitor, aluno);
        const doMonitor = await como(monitor);
        await doMonitor.patch(`/agendamentos/${ag.id}/ausencia`);

        const correcao = await doMonitor.patch(`/agendamentos/${ag.id}/concluir`);

        expect(correcao.status).toBe(200);
        const gravado = await h.prisma.agendamento.findUnique({ where: { id: ag.id } });
        expect(gravado.ausente_em).toBeNull();
        expect(gravado.presenca_monitor_em).toBeInstanceOf(Date);
    });
});

describe('Bloqueio por faltas', () => {
    it('3 faltas em 30 dias: nova inscrição e fila dão 423; a inscrição antiga continua', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const doMonitor = await como(monitor);
        // Uma inscrição futura feita antes do bloqueio
        const futura = await h.criarVaga({ monitor, disciplina: await h.criarDisciplina() });
        const antiga = await h.inscrever(aluno, futura);
        for (const horas of [3, 4, 5]) {
            const { ag } = await sessaoPassada(monitor, aluno, horas);
            expect((await doMonitor.patch(`/agendamentos/${ag.id}/ausencia`)).status).toBe(200);
        }
        const doAluno = await como(aluno);

        const restricao = await doAluno.get('/perfil/restricao');
        expect(restricao.body.restricao.faltas).toBe(3);
        const ate = new Date(restricao.body.restricao.ate);
        expect(ate.getTime()).toBeGreaterThan(Date.now() + 6.9 * 24 * h.HORA);

        const nova = await h.criarVaga({
            monitor,
            disciplina: await h.criarDisciplina(),
            capacidade: 2
        });
        const inscricao = await doAluno.post('/agendamentos', { id_monitoria: nova.id });
        expect(inscricao.status).toBe(423);
        expect(inscricao.body.erro).toMatch(/faltou a 3 monitorias.*bloqueadas até/);

        const lotada = await h.criarVaga({ monitor, disciplina: await h.criarDisciplina() });
        await h.inscrever(await h.criarUsuario('aluno'), lotada);
        expect((await doAluno.post(`/monitorias/${lotada.id}/espera`)).status).toBe(423);

        expect((await h.prisma.agendamento.findUnique({ where: { id: antiga.id } })).status).toBe(
            'pendente'
        );
    });

    it('faltas com mais de 37 dias não contam; sem bloqueio, restrição null', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        for (const dias of [40, 45, 50]) {
            const { ag } = await sessaoPassada(monitor, aluno, dias * 24);
            await h.prisma.agendamento.update({
                where: { id: ag.id },
                data: { ausente_em: new Date(Date.now() - dias * 24 * h.HORA) }
            });
        }
        const doAluno = await como(aluno);
        expect((await doAluno.get('/perfil/restricao')).body.restricao).toBeNull();
    });
});

describe('Retenção (LGPD)', () => {
    it('marcações de falta com mais de 180 dias são apagadas; a inscrição fica', async () => {
        const privacidadeService = require('../../src/services/privacidadeService');
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const { ag } = await sessaoPassada(monitor, aluno, 200 * 24);
        await h.prisma.agendamento.update({
            where: { id: ag.id },
            data: { ausente_em: new Date(Date.now() - 181 * 24 * h.HORA) }
        });

        const r = await privacidadeService.aplicarRetencao({ aplicar: true });

        expect(r.ausencias).toBe(1);
        const gravado = await h.prisma.agendamento.findUnique({ where: { id: ag.id } });
        expect(gravado).not.toBeNull();
        expect(gravado.ausente_em).toBeNull();
    });
});
