// Plano 7, PR 4, contra o Postgres real: a coordenação marca falta depois do prazo do monitor e
// anula falta com justificativa; o bloqueio por faltas é recalculado na hora.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
const como = async (usuario) => {
    const cookie = await h.cookieDe(usuario);
    return {
        get: (url) => request(app).get(url).set('Cookie', cookie),
        post: (url, corpo = {}) =>
            request(app).post(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo)
    };
};

async function inscricaoPassada(monitor, aluno, diasAtras, extra = {}) {
    const disciplina = await h.criarDisciplina();
    const vaga = await h.criarVaga({ monitor, disciplina, emMs: -diasAtras * h.DIA });
    const ag = await h.inscrever(aluno, vaga);
    if (Object.keys(extra).length)
        await h.prisma.agendamento.update({ where: { id: ag.id }, data: extra });
    return ag;
}

describe('Faltas pela coordenação', () => {
    it('marca falta depois dos 7 dias do monitor; o monitor não consegue mais', async () => {
        const coord = await h.criarUsuario('coordenador');
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const ag = await inscricaoPassada(monitor, aluno, 10);

        const tardeDemais = await request(app)
            .patch(`/agendamentos/${ag.id}/ausencia`)
            .set('Cookie', await h.cookieDe(monitor))
            .set('Origin', ORIGEM);
        // Passou o prazo de 7 dias do monitor
        expect(tardeDemais.status).not.toBe(200);

        const doCoord = await como(coord);
        const lista = await doCoord.get('/admin/faltas');
        expect(lista.body.sem_presenca.map((x) => x.id)).toEqual([ag.id]);

        expect((await doCoord.post(`/admin/agendamentos/${ag.id}/falta`)).status).toBe(200);
        expect((await doCoord.post(`/admin/agendamentos/${ag.id}/falta`)).status).toBe(409);
        const gravado = await h.prisma.agendamento.findUnique({ where: { id: ag.id } });
        expect(gravado.ausente_em).toBeInstanceOf(Date);
        expect(await h.prisma.auditoria.count({ where: { acao: 'marcar_falta' } })).toBe(1);

        const depois = await doCoord.get('/admin/faltas');
        expect(depois.body.faltas.map((x) => x.id)).toEqual([ag.id]);
        expect(depois.body.sem_presenca).toEqual([]);
    });

    it('presença confirmada pelos dois continua sem falta (409)', async () => {
        const coord = await h.criarUsuario('coordenador');
        const ag = await inscricaoPassada(
            await h.criarUsuario('monitor'),
            await h.criarUsuario('aluno'),
            2,
            {
                status: 'concluido'
            }
        );
        expect((await (await como(coord)).post(`/admin/agendamentos/${ag.id}/falta`)).status).toBe(
            409
        );
    });

    it('anular falta desbloqueia o aluno na hora, sem virar presença', async () => {
        const coord = await h.criarUsuario('coordenador');
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const agora = Date.now();
        const ags = [];
        for (const dias of [3, 2, 1]) {
            ags.push(
                await inscricaoPassada(monitor, aluno, dias, {
                    ausente_em: new Date(agora - dias * h.HORA)
                })
            );
        }
        const doAluno = await como(aluno);
        expect((await doAluno.get('/perfil/restricao')).body.restricao).not.toBeNull();

        const doCoord = await como(coord);
        const lista = await doCoord.get('/admin/faltas');
        expect(lista.body.bloqueados).toEqual([
            expect.objectContaining({ aluno: aluno.nome_completo, faltas: 3 })
        ]);

        expect(
            (
                await doCoord.post(`/admin/agendamentos/${ags[0].id}/anular-falta`, {
                    motivo: 'curta'
                })
            ).status
        ).toBe(400);
        const r = await doCoord.post(`/admin/agendamentos/${ags[0].id}/anular-falta`, {
            motivo: 'Atestado médico entregue na coordenação.'
        });
        expect(r.status).toBe(200);

        const gravado = await h.prisma.agendamento.findUnique({ where: { id: ags[0].id } });
        expect(gravado).toMatchObject({
            ausente_em: null,
            status: 'pendente',
            presenca_monitor_em: null
        });
        expect((await doAluno.get('/perfil/restricao')).body.restricao).toBeNull();
        expect((await doCoord.get('/admin/faltas')).body.bloqueados).toEqual([]);
        expect(
            (
                await doCoord.post(`/admin/agendamentos/${ags[0].id}/anular-falta`, {
                    motivo: 'De novo, por engano.'
                })
            ).status
        ).toBe(409);
    });

    it('aluno e monitor recebem 403', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const ag = await inscricaoPassada(monitor, aluno, 1);
        for (const u of [monitor, aluno]) {
            const c = await como(u);
            expect((await c.get('/admin/faltas')).status).toBe(403);
            expect((await c.post(`/admin/agendamentos/${ag.id}/falta`)).status).toBe(403);
        }
    });
});
