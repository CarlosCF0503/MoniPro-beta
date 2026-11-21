// Plano 7, PR 3, contra o Postgres real: disciplina criada por monitor fica pendente, só quem
// criou a vê, e a coordenação aprova ou mescla (vagas e pontos passam para a aprovada).
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

async function cenario() {
    const coord = await h.criarUsuario('coordenador');
    const criador = await h.criarUsuario('monitor');
    const outro = await h.criarUsuario('monitor');
    const aluno = await h.criarUsuario('aluno');
    const calc = await h.criarDisciplina('Cálculo I');
    const doCriador = await como(criador);
    const r = await doCriador.post('/disciplinas', { nome: 'Calculo 1' });
    return {
        coord,
        criador,
        outro,
        aluno,
        calc,
        doCriador,
        pendente: r.body.disciplina,
        resposta: r
    };
}

describe('Disciplina pendente', () => {
    it('nasce pendente e só aparece para quem criou e para a coordenação', async () => {
        const { coord, outro, aluno, doCriador, pendente, resposta } = await cenario();
        expect(resposta.status).toBe(201);
        expect(pendente).toMatchObject({ status: 'pendente' });

        const nomes = async (u) =>
            (await (await como(u)).get('/disciplinas')).body.disciplinas.map((d) => d.nome);
        expect(await nomes(aluno)).toEqual(['Cálculo I']);
        expect(await nomes(outro)).toEqual(['Cálculo I']);
        expect(await nomes(coord)).toEqual(['Calculo 1', 'Cálculo I']);
        expect((await doCriador.get('/disciplinas')).body.disciplinas).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ nome: 'Calculo 1', status: 'pendente' })
            ])
        );
    });

    it('vagas: o criador abre e vê; aluno e outro monitor não veem nem se inscrevem', async () => {
        const { criador, outro, aluno, doCriador, pendente } = await cenario();
        const horario = new Date(Date.now() + 3 * h.DIA).toISOString();
        const criada = await doCriador.post('/monitorias', {
            id_disciplina: pendente.id,
            horario,
            local: 'Sala 1',
            capacidade: 1
        });
        expect(criada.status).toBe(201);
        const idVaga = criada.body.monitoria.id;

        expect(
            (await doCriador.get(`/monitorias/${pendente.id}?limit=10`)).body.monitorias
        ).toHaveLength(1);
        const doAluno = await como(aluno);
        expect((await doAluno.get(`/monitorias/${pendente.id}?limit=10`)).status).toBe(404);
        expect((await doAluno.get(`/disciplinas/${pendente.id}/ranking`)).status).toBe(404);

        const insc = await doAluno.post('/agendamentos', { id_monitoria: idVaga });
        expect(insc.status).toBe(400);
        expect(await h.prisma.agendamento.count()).toBe(0);
        expect((await doAluno.post(`/monitorias/${idVaga}/espera`)).status).toBe(404);

        const doOutro = await como(outro);
        const tentativa = await doOutro.post('/monitorias', {
            id_disciplina: pendente.id,
            horario,
            local: 'Sala 2'
        });
        expect(tentativa.status).toBe(400);
        expect(criador.id).not.toBe(outro.id);
    });
});

describe('Revisão pela coordenação', () => {
    it('lista com a sugestão de parecida; aprovar publica para os alunos', async () => {
        const { coord, aluno, doCriador, pendente } = await cenario();
        await doCriador.post('/monitorias', {
            id_disciplina: pendente.id,
            horario: new Date(Date.now() + 3 * h.DIA).toISOString(),
            local: 'Sala 1'
        });
        const doCoord = await como(coord);

        const lista = await doCoord.get('/admin/disciplinas');
        expect(lista.body.disciplinas).toEqual([
            expect.objectContaining({
                nome: 'Calculo 1',
                vagas: 1,
                parecida: expect.objectContaining({ nome: 'Cálculo I' })
            })
        ]);

        expect((await doCoord.post(`/admin/disciplinas/${pendente.id}/aprovar`)).status).toBe(200);
        expect((await doCoord.post(`/admin/disciplinas/${pendente.id}/aprovar`)).status).toBe(409);
        const doAluno = await como(aluno);
        expect(
            (await doAluno.get(`/monitorias/${pendente.id}?limit=10`)).body.monitorias
        ).toHaveLength(1);
        expect(await h.prisma.auditoria.count({ where: { acao: 'aprovar_disciplina' } })).toBe(1);
    });

    it('mesclar move vagas e pontos para a aprovada e apaga a pendente', async () => {
        const { coord, criador, calc, doCriador, pendente } = await cenario();
        const vaga = await doCriador.post('/monitorias', {
            id_disciplina: pendente.id,
            horario: new Date(Date.now() + 3 * h.DIA).toISOString(),
            local: 'Sala 1'
        });
        await h.prisma.eventoPontuacao.create({
            data: {
                id_usuario: criador.id,
                tipo: 'sessao_monitor',
                pontos: 10,
                id_disciplina: pendente.id,
                periodo: '2026.2',
                chave: 'integracao:mesclar:1'
            }
        });
        const doCoord = await como(coord);

        const r = await doCoord.post(`/admin/disciplinas/${pendente.id}/mesclar`, {
            id_destino: calc.id
        });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ vagas: 1, pontos: 1 });

        expect(await h.prisma.disciplina.findUnique({ where: { id: pendente.id } })).toBeNull();
        const movida = await h.prisma.monitoria.findUnique({
            where: { id: vaga.body.monitoria.id }
        });
        expect(movida.id_disciplina).toBe(calc.id);
        expect(await h.prisma.eventoPontuacao.count({ where: { id_disciplina: calc.id } })).toBe(1);
        expect(
            await h.prisma.auditoria.findFirst({ where: { acao: 'mesclar_disciplina' } })
        ).toMatchObject({
            alvo: `disciplina:${calc.id}`
        });
    });

    it('mesclar com outra pendente ou com ela mesma: 400, nada muda', async () => {
        const { coord, pendente } = await cenario();
        const outraPendente = await h.prisma.disciplina.create({
            data: { nome: 'Outra', status: 'pendente' }
        });
        const doCoord = await como(coord);
        expect(
            (
                await doCoord.post(`/admin/disciplinas/${pendente.id}/mesclar`, {
                    id_destino: outraPendente.id
                })
            ).status
        ).toBe(400);
        expect(
            (
                await doCoord.post(`/admin/disciplinas/${pendente.id}/mesclar`, {
                    id_destino: pendente.id
                })
            ).status
        ).toBe(400);
        expect(await h.prisma.disciplina.count({ where: { status: 'pendente' } })).toBe(2);
        expect(await h.prisma.auditoria.count()).toBe(0);
    });
});
