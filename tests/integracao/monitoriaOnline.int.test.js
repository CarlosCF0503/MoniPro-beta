// Plano 11 (RF-016), contra o Postgres real: o link da sala só chega a quem tem lugar na vaga.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
const LINK = 'https://meet.google.com/abc-defg-hij';
const como = async (usuario) => {
    const cookie = await h.cookieDe(usuario);
    return {
        post: (url, corpo = {}) =>
            request(app).post(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo),
        patch: (url, corpo) =>
            request(app).patch(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo),
        get: (url) => request(app).get(url).set('Cookie', cookie)
    };
};
const emDias = (dias) => new Date(Date.now() + dias * 24 * h.HORA).toISOString();

async function vagaOnline({ capacidade = 1 } = {}) {
    const monitor = await h.criarUsuario('monitor');
    const disciplina = await h.criarDisciplina();
    const r = await (
        await como(monitor)
    ).post('/monitorias', {
        id_disciplina: disciplina.id,
        horario: emDias(3),
        capacidade,
        modalidade: 'online',
        link: LINK
    });
    expect(r.status).toBe(201);
    return { monitor, disciplina, vaga: r.body.monitoria };
}

describe('Criar vaga on-line', () => {
    it('grava a modalidade e o link, com o local "On-line"', async () => {
        const { vaga } = await vagaOnline();
        const gravada = await h.prisma.monitoria.findUnique({ where: { id: vaga.id } });
        expect(gravada).toMatchObject({ modalidade: 'online', link: LINK, local: 'On-line' });
    });

    it('link de fora da lista: 400 e nada é gravado', async () => {
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        const r = await (
            await como(monitor)
        ).post('/monitorias', {
            id_disciplina: disciplina.id,
            horario: emDias(3),
            modalidade: 'online',
            link: 'https://bit.ly/sala'
        });
        expect(r.status).toBe(400);
        expect(await h.prisma.monitoria.count()).toBe(0);
    });
});

describe('Quem vê o link', () => {
    it('a listagem pública nunca traz o link', async () => {
        const { disciplina } = await vagaOnline();
        const curioso = await h.criarUsuario('aluno');

        const r = await (await como(curioso)).get(`/monitorias/${disciplina.id}`);

        expect(r.status).toBe(200);
        expect(r.body.monitorias[0]).toMatchObject({ modalidade: 'online', local: 'On-line' });
        expect(JSON.stringify(r.body)).not.toContain('meet.google.com');
    });

    it('o inscrito vê o link no perfil; quem está na fila não', async () => {
        const { vaga } = await vagaOnline({ capacidade: 1 });
        const inscrito = await h.criarUsuario('aluno');
        const naFila = await h.criarUsuario('aluno');
        const doInscrito = await como(inscrito);
        const daFila = await como(naFila);
        expect((await doInscrito.post('/agendamentos', { id_monitoria: vaga.id })).status).toBe(
            201
        );
        expect((await daFila.post(`/monitorias/${vaga.id}/espera`)).status).toBe(201);

        const perfilInscrito = await doInscrito.get('/perfil/agendamentos');
        const perfilFila = await daFila.get('/perfil/agendamentos');
        const lista = await daFila.get('/agendamentos');

        expect(perfilInscrito.body.agendamentos[0].monitoria.link).toBe(LINK);
        expect(perfilFila.body.agendamentos[0].monitoria.link).toBeNull();
        expect(JSON.stringify(lista.body)).not.toContain('meet.google.com');
    });

    it('o e-mail de inscrição leva o link; o da fila (vaga alterada) não', async () => {
        const { monitor, vaga } = await vagaOnline({ capacidade: 1 });
        const inscrito = await h.criarUsuario('aluno');
        const naFila = await h.criarUsuario('aluno');
        await (await como(inscrito)).post('/agendamentos', { id_monitoria: vaga.id });
        await (await como(naFila)).post(`/monitorias/${vaga.id}/espera`);

        const novo = 'https://meet.jit.si/MonitoriaNova';
        const edicao = await (await como(monitor)).patch(`/monitorias/${vaga.id}`, { link: novo });
        expect(edicao.status).toBe(200);
        expect(edicao.body.liberados).toBe(1);

        const inscricao = await h.prisma.notificacao.findFirst({ where: { modelo: 'inscricao' } });
        expect(inscricao.dados.link).toBe(LINK);
        const alteradas = await h.prisma.notificacao.findMany({
            where: { modelo: 'vaga-alterada' }
        });
        const paraInscrito = alteradas.find((n) => n.id_usuario === inscrito.id).dados;
        const paraFila = alteradas.find((n) => n.id_usuario === naFila.id).dados;
        expect(paraInscrito).toMatchObject({ link: novo, link_alterado: true });
        expect(paraFila).not.toHaveProperty('link');
        expect(paraFila).not.toHaveProperty('link_alterado');
    });
});

describe('Editar a modalidade', () => {
    it('presencial → on-line conta como mudança de local; on-line → presencial exige o local', async () => {
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, capacidade: 2 });
        const aluno = await h.criarUsuario('aluno');
        const ag = await h.inscrever(aluno, vaga);
        const doMonitor = await como(monitor);

        const paraOnline = await doMonitor.patch(`/monitorias/${vaga.id}`, {
            modalidade: 'online',
            link: LINK
        });
        expect(paraOnline.status).toBe(200);
        expect(paraOnline.body.liberados).toBe(1);
        expect(await h.prisma.monitoria.findUnique({ where: { id: vaga.id } })).toMatchObject({
            modalidade: 'online',
            local: 'On-line',
            link: LINK
        });
        const liberado = await h.prisma.agendamento.findUnique({ where: { id: ag.id } });
        expect(liberado.liberado_cancelar_em).toBeInstanceOf(Date);
        expect(liberado.local_anterior).toBe('Sala 101');

        const semLocal = await doMonitor.patch(`/monitorias/${vaga.id}`, {
            modalidade: 'presencial'
        });
        expect(semLocal.status).toBe(400);

        const voltou = await doMonitor.patch(`/monitorias/${vaga.id}`, {
            modalidade: 'presencial',
            local: 'Sala 204'
        });
        expect(voltou.status).toBe(200);
        expect(await h.prisma.monitoria.findUnique({ where: { id: vaga.id } })).toMatchObject({
            modalidade: 'presencial',
            local: 'Sala 204',
            link: null
        });
    });

    it('link numa vaga presencial: 400', async () => {
        const monitor = await h.criarUsuario('monitor');
        const vaga = await h.criarVaga({ monitor, disciplina: await h.criarDisciplina() });
        const r = await (await como(monitor)).patch(`/monitorias/${vaga.id}`, { link: LINK });
        expect(r.status).toBe(400);
    });
});
