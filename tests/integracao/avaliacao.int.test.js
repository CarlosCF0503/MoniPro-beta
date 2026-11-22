// Plano 6, contra o Postgres real: o aluno avalia, o monitor vê o resumo sem nome, a
// coordenação oculta o comentário e a nota oculta sai da média (decisão de 22/11).
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

/** Inscrição concluída (presença dos dois lados) numa sessão de `diasAtras` dias. */
async function sessaoConcluida(monitor, aluno, diasAtras = 1, status = 'concluido') {
    const vaga = await h.criarVaga({
        monitor,
        disciplina: await h.criarDisciplina(),
        emMs: -diasAtras * h.DIA
    });
    const ag = await h.inscrever(aluno, vaga);
    await h.prisma.agendamento.update({ where: { id: ag.id }, data: { status } });
    return ag;
}

describe('Avaliação da monitoria', () => {
    it('três alunos avaliam; o monitor vê média, distribuição e comentários sem nome', async () => {
        const monitor = await h.criarUsuario('monitor');
        const notas = [
            [5, 'Muito clara.'],
            [4, null],
            [3, 'Poderia ter mais exemplos.']
        ];
        for (const [nota, comentario] of notas) {
            const aluno = await h.criarUsuario('aluno');
            const ag = await sessaoConcluida(monitor, aluno);
            const r = await (
                await como(aluno)
            ).post(`/agendamentos/${ag.id}/avaliacao`, { nota, comentario });
            expect(r.status).toBe(201);
        }
        const r = await (await como(monitor)).get('/perfil/avaliacoes/resumo');
        expect(r.body).toMatchObject({ total: 3, media: 4, distribuicao: { 3: 1, 4: 1, 5: 1 } });
        expect(r.body.comentarios.map((c) => c.comentario).sort()).toEqual([
            'Muito clara.',
            'Poderia ter mais exemplos.'
        ]);
        const texto = JSON.stringify(r.body);
        expect(texto).not.toMatch(/id_aluno|id_agendamento|criado_em|FICTÍCIO\] aluno/);
    });

    it('presença não confirmada, prazo vencido, outro aluno e segunda vez são recusados', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const doAluno = await como(aluno);
        const pendente = await sessaoConcluida(monitor, aluno, 1, 'pendente');
        expect(
            (await doAluno.post(`/agendamentos/${pendente.id}/avaliacao`, { nota: 5 })).status
        ).toBe(422);
        const antiga = await sessaoConcluida(monitor, aluno, 8);
        expect(
            (await doAluno.post(`/agendamentos/${antiga.id}/avaliacao`, { nota: 5 })).status
        ).toBe(422);
        const ok = await sessaoConcluida(monitor, aluno, 1);
        const outro = await como(await h.criarUsuario('aluno'));
        expect((await outro.post(`/agendamentos/${ok.id}/avaliacao`, { nota: 5 })).status).toBe(
            404
        );
        expect((await doAluno.post(`/agendamentos/${ok.id}/avaliacao`, { nota: 5 })).status).toBe(
            201
        );
        expect((await doAluno.post(`/agendamentos/${ok.id}/avaliacao`, { nota: 4 })).status).toBe(
            409
        );
        const perfil = await doAluno.get('/perfil/agendamentos?limit=10&page=1');
        expect(perfil.body.agendamentos.find((a) => a.id === ok.id).avaliacao).toEqual({ nota: 5 });
    });

    it('o banco recusa nota fora de 1 a 5 mesmo sem passar pela API', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const ag = await sessaoConcluida(monitor, aluno);
        await expect(
            h.prisma.avaliacao.create({
                data: { id_agendamento: ag.id, id_aluno: aluno.id, id_monitor: monitor.id, nota: 7 }
            })
        ).rejects.toThrow();
    });

    it('comentário oculto some para o monitor e a nota sai da média; mostrar de novo devolve', async () => {
        const coord = await h.criarUsuario('coordenador');
        const monitor = await h.criarUsuario('monitor');
        for (const [nota, comentario] of [
            [5, 'Ótima.'],
            [5, 'Excelente.'],
            [5, 'Muito boa.'],
            [1, 'Comentário pessoal ofensivo.']
        ]) {
            const aluno = await h.criarUsuario('aluno');
            const ag = await sessaoConcluida(monitor, aluno);
            await (
                await como(aluno)
            ).post(`/agendamentos/${ag.id}/avaliacao`, { nota, comentario });
        }
        const doMonitor = await como(monitor);
        expect((await doMonitor.get('/perfil/avaliacoes/resumo')).body).toMatchObject({
            total: 4,
            media: 4
        });

        const doCoord = await como(coord);
        const lista = await doCoord.get('/admin/avaliacoes');
        expect(JSON.stringify(lista.body)).not.toMatch(/aluno/i);
        const alvo = lista.body.avaliacoes.find((a) => a.nota === 1);
        expect(
            (await doCoord.post(`/admin/avaliacoes/${alvo.id}/ocultar`, { motivo: 'curto' })).status
        ).toBe(400);
        expect(
            (
                await doCoord.post(`/admin/avaliacoes/${alvo.id}/ocultar`, {
                    motivo: 'Ofensa pessoal ao monitor.'
                })
            ).status
        ).toBe(200);

        const depois = (await doMonitor.get('/perfil/avaliacoes/resumo')).body;
        expect(depois).toMatchObject({ total: 3, media: 5, distribuicao: { 1: 0, 5: 3 } });
        expect(depois.comentarios.map((c) => c.comentario)).not.toContain(
            'Comentário pessoal ofensivo.'
        );
        const tabela = await doCoord.get('/admin/monitores');
        expect(tabela.body.monitores[0].avaliacao).toEqual({ total: 3, media: 5 });

        expect((await doCoord.post(`/admin/avaliacoes/${alvo.id}/reexibir`)).status).toBe(200);
        expect((await doMonitor.get('/perfil/avaliacoes/resumo')).body).toMatchObject({
            total: 4,
            media: 4
        });
        expect(
            await h.prisma.auditoria.count({
                where: { acao: { in: ['ocultar_avaliacao', 'reexibir_avaliacao'] } }
            })
        ).toBe(2);
    });

    it('excluir a conta do aluno apaga as avaliações que ele deu', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const ag = await sessaoConcluida(monitor, aluno);
        await (await como(aluno)).post(`/agendamentos/${ag.id}/avaliacao`, { nota: 4 });
        const r = await request(app)
            .delete('/perfil')
            .set('Cookie', await h.cookieDe(aluno))
            .set('Origin', ORIGEM)
            .send({ senha: 'senhaIntegracao1' });
        expect(r.status).toBe(200);
        expect(await h.prisma.avaliacao.count()).toBe(0);
    });
});
