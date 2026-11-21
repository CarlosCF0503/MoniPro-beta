// Plano 7, contra o Postgres real: o aluno pede revisão da falta com comprovante; a coordenação
// baixa o arquivo e aceita (a falta é anulada) ou recusa. Retenção e exclusão da conta apagam.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');
const privacidadeService = require('../../src/services/privacidadeService');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(1024, 7)]);
const como = async (usuario) => {
    const cookie = await h.cookieDe(usuario);
    return {
        get: (url) => request(app).get(url).set('Cookie', cookie),
        post: (url, corpo = {}) =>
            request(app).post(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo)
    };
};
const pedido = {
    justificativa: 'Consulta médica no horário da monitoria.',
    arquivo: { nome: 'atestado.pdf', tipo: 'application/pdf', conteudo: PDF.toString('base64') }
};

async function cenario({ diasDaFalta = 1 } = {}) {
    const coord = await h.criarUsuario('coordenador');
    const monitor = await h.criarUsuario('monitor');
    const aluno = await h.criarUsuario('aluno');
    const vaga = await h.criarVaga({
        monitor,
        disciplina: await h.criarDisciplina(),
        emMs: -(diasDaFalta + 1) * h.DIA
    });
    const ag = await h.inscrever(aluno, vaga);
    await h.prisma.agendamento.update({
        where: { id: ag.id },
        data: { ausente_em: new Date(Date.now() - diasDaFalta * h.DIA) }
    });
    return { coord, monitor, aluno, ag };
}

describe('Pedido de revisão da falta', () => {
    it('aluno pede; aparece no perfil e no painel; a coordenação baixa o arquivo e aceita', async () => {
        const { coord, aluno, ag } = await cenario();
        const doAluno = await como(aluno);

        const r = await doAluno.post(`/agendamentos/${ag.id}/recurso`, pedido);
        expect(r.status).toBe(201);
        expect(r.body.recurso).toMatchObject({ status: 'pendente' });
        expect((await doAluno.post(`/agendamentos/${ag.id}/recurso`, pedido)).status).toBe(409);

        const perfil = await doAluno.get('/perfil/agendamentos?limit=10&page=1');
        expect(perfil.body.agendamentos[0].recurso).toMatchObject({ status: 'pendente' });
        expect(perfil.body.agendamentos[0].recurso).not.toHaveProperty('arquivo');

        const doCoord = await como(coord);
        const faltas = await doCoord.get('/admin/faltas');
        expect(faltas.body.recursos).toEqual([
            expect.objectContaining({
                id_agendamento: ag.id,
                justificativa: pedido.justificativa,
                arquivo: { nome: 'atestado.pdf', tipo: 'application/pdf', tamanho: PDF.length }
            })
        ]);
        const id = faltas.body.recursos[0].id;

        const arq = await doCoord
            .get(`/admin/recursos/${id}/arquivo`)
            .buffer(true)
            .parse((res, cb) => {
                const partes = [];
                res.on('data', (c) => partes.push(c));
                res.on('end', () => cb(null, Buffer.concat(partes)));
            });
        expect(arq.status).toBe(200);
        expect(arq.headers['content-type']).toBe('application/pdf');
        expect(arq.body.equals(PDF)).toBe(true);
        expect((await doAluno.get(`/admin/recursos/${id}/arquivo`)).status).toBe(403);

        expect((await doCoord.post(`/admin/recursos/${id}/aceitar`)).status).toBe(200);
        expect((await doCoord.post(`/admin/recursos/${id}/aceitar`)).status).toBe(409);
        const gravado = await h.prisma.agendamento.findUnique({ where: { id: ag.id } });
        expect(gravado).toMatchObject({
            ausente_em: null,
            status: 'pendente',
            presenca_monitor_em: null
        });
        expect(await h.prisma.auditoria.count({ where: { acao: 'aceitar_recurso' } })).toBe(1);
        expect((await doCoord.get('/admin/faltas')).body.recursos).toEqual([]);
    });

    it('recusar mantém a falta e guarda o motivo para o aluno ver', async () => {
        const { coord, aluno, ag } = await cenario();
        const doAluno = await como(aluno);
        await doAluno.post(`/agendamentos/${ag.id}/recurso`, pedido);
        const doCoord = await como(coord);
        const id = (await doCoord.get('/admin/faltas')).body.recursos[0].id;

        expect(
            (await doCoord.post(`/admin/recursos/${id}/recusar`, { motivo: 'curto' })).status
        ).toBe(400);
        expect(
            (
                await doCoord.post(`/admin/recursos/${id}/recusar`, {
                    motivo: 'O atestado é de outra data.'
                })
            ).status
        ).toBe(200);
        const gravado = await h.prisma.agendamento.findUnique({ where: { id: ag.id } });
        expect(gravado.ausente_em).toBeInstanceOf(Date);
        const perfil = await doAluno.get('/perfil/agendamentos?limit=10&page=1');
        expect(perfil.body.agendamentos[0].recurso).toMatchObject({
            status: 'recusado',
            motivo_decisao: 'O atestado é de outra data.'
        });
    });

    it('outro aluno, falta de mais de 30 dias e arquivo falso são recusados', async () => {
        const { ag } = await cenario();
        const outro = await como(await h.criarUsuario('aluno'));
        expect((await outro.post(`/agendamentos/${ag.id}/recurso`, pedido)).status).toBe(404);

        const antigo = await cenario({ diasDaFalta: 31 });
        const doAluno = await como(antigo.aluno);
        expect((await doAluno.post(`/agendamentos/${antigo.ag.id}/recurso`, pedido)).status).toBe(
            422
        );

        const falso = {
            ...pedido,
            arquivo: { ...pedido.arquivo, conteudo: Buffer.from('<html>').toString('base64') }
        };
        const recente = await cenario();
        expect(
            (
                await (
                    await como(recente.aluno)
                ).post(`/agendamentos/${recente.ag.id}/recurso`, falso)
            ).status
        ).toBe(400);
        expect(await h.prisma.recursoFalta.count()).toBe(0);
    });

    it('retenção apaga depois de 180 dias; excluir a conta apaga na hora', async () => {
        const { aluno, ag } = await cenario();
        await (await como(aluno)).post(`/agendamentos/${ag.id}/recurso`, pedido);
        await h.prisma.recursoFalta.updateMany({
            data: { criado_em: new Date(Date.now() - 181 * h.DIA) }
        });
        const simulado = await privacidadeService.aplicarRetencao({ aplicar: false });
        expect(simulado.recursos).toBe(1);
        const aplicado = await privacidadeService.aplicarRetencao({ aplicar: true });
        expect(aplicado.recursos).toBe(1);
        expect(await h.prisma.recursoFalta.count()).toBe(0);

        const outro = await cenario();
        await (await como(outro.aluno)).post(`/agendamentos/${outro.ag.id}/recurso`, pedido);
        const r = await request(app)
            .delete('/perfil')
            .set('Cookie', await h.cookieDe(outro.aluno))
            .set('Origin', ORIGEM)
            .send({ senha: 'senhaIntegracao1' });
        expect(r.status).toBe(200);
        expect(await h.prisma.recursoFalta.count()).toBe(0);
    });
});
