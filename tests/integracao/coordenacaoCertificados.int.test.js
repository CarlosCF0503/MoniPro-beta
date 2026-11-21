// Plano 7, PR 2, contra o Postgres real: a coordenação assina e revoga certificados, com
// auditoria, e a verificação pública mostra a assinatura.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');
const { periodoDe } = require('../../src/utils/periodo');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
let seq = 0;
const como = async (usuario) => {
    const cookie = await h.cookieDe(usuario);
    return {
        get: (url) => request(app).get(url).set('Cookie', cookie),
        post: (url, corpo = {}) =>
            request(app).post(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo)
    };
};

async function certificado(monitor, extra = {}) {
    seq += 1;
    return await h.prisma.certificado.create({
        data: {
            // Só letras e números do alfabeto do código (sem I, L, O, U, 0 e 1)
            codigo: `KQFMXHBTPZDWQA${String(seq)
                .replace(/[01]/g, (d) => (d === '0' ? '2' : '3'))
                .padStart(12, '9')}`,
            id_usuario: monitor.id,
            periodo: periodoDe(),
            carga_minutos: 150,
            snapshot: {
                nome: monitor.nome_completo,
                sessoes_total: 2,
                sessoes: [
                    { data: new Date().toISOString(), disciplina: 'Cálculo I', minutos: 90 },
                    { data: new Date().toISOString(), disciplina: 'Física I', minutos: 60 }
                ]
            },
            ...extra
        }
    });
}

describe('Certificados no painel', () => {
    it('assina: o certificado mostra quem assinou, a verificação também, e entra na auditoria', async () => {
        const coord = await h.criarUsuario('coordenador', { nome_completo: 'Profa. Integração' });
        const monitor = await h.criarUsuario('monitor');
        const c = await certificado(monitor);
        const doCoord = await como(coord);

        const lista = await doCoord.get('/admin/certificados?situacao=pendente');
        expect(lista.body.certificados.map((x) => [x.id, x.sessoes])).toEqual([[c.id, 2]]);

        const r = await doCoord.post(`/admin/certificados/${c.id}/assinar`);
        expect(r.status).toBe(200);

        const gravado = await h.prisma.certificado.findUnique({ where: { id: c.id } });
        expect(gravado).toMatchObject({
            id_assinante: coord.id,
            assinante_nome: 'Profa. Integração'
        });
        expect(gravado.assinado_em).toBeInstanceOf(Date);

        const v = await request(app).get(`/certificados/verificar/${c.codigo}`);
        expect(v.body.declaracao).toMatchObject({
            situacao: 'valido',
            assinante: 'Profa. Integração'
        });

        expect(
            (await doCoord.get('/admin/certificados?situacao=pendente')).body.certificados
        ).toEqual([]);
        expect(
            (await doCoord.get('/admin/certificados?situacao=assinado')).body.certificados
        ).toHaveLength(1);
        const log = await h.prisma.auditoria.findMany();
        expect(log).toEqual([
            expect.objectContaining({
                id_usuario: coord.id,
                acao: 'assinar_certificado',
                alvo: `certificado:${c.id}`
            })
        ]);

        // A segunda tentativa não grava nada
        expect((await doCoord.post(`/admin/certificados/${c.id}/assinar`)).status).toBe(409);
        expect(await h.prisma.auditoria.count()).toBe(1);
    });

    it('duas assinaturas ao mesmo tempo: uma passa, a outra recebe 409', async () => {
        const coord = await h.criarUsuario('coordenador');
        const c = await certificado(await h.criarUsuario('monitor'));
        const doCoord = await como(coord);
        const [a, b] = await Promise.all([
            doCoord.post(`/admin/certificados/${c.id}/assinar`),
            doCoord.post(`/admin/certificados/${c.id}/assinar`)
        ]);
        expect([a.status, b.status].sort()).toEqual([200, 409]);
        expect(await h.prisma.auditoria.count()).toBe(1);
    });

    it('revoga com motivo; o monitor pode emitir outro depois', async () => {
        const coord = await h.criarUsuario('coordenador');
        const monitor = await h.criarUsuario('monitor');
        const c = await certificado(monitor);
        const doCoord = await como(coord);

        expect(
            (await doCoord.post(`/admin/certificados/${c.id}/revogar`, { motivo: 'curto' })).status
        ).toBe(400);
        const r = await doCoord.post(`/admin/certificados/${c.id}/revogar`, {
            motivo: 'Sessões registradas sem alunos presentes.'
        });
        expect(r.status).toBe(200);

        const gravado = await h.prisma.certificado.findUnique({ where: { id: c.id } });
        expect(gravado).toMatchObject({
            situacao: 'revogado',
            motivo_revogacao: 'Sessões registradas sem alunos presentes.'
        });
        const v = await request(app).get(`/certificados/verificar/${c.codigo}`);
        expect(v.body.declaracao.situacao).toBe('revogado');
        expect(
            (
                await doCoord.post(`/admin/certificados/${c.id}/revogar`, {
                    motivo: 'De novo, por engano.'
                })
            ).status
        ).toBe(409);

        // Decisão de 21/11: depois de revogado, um novo certificado do mesmo semestre é aceito
        const novo = await certificado(monitor);
        expect(novo.situacao).toBe('valido');
    });

    it('substituído não pode ser assinado', async () => {
        const coord = await h.criarUsuario('coordenador');
        const c = await certificado(await h.criarUsuario('monitor'), { situacao: 'substituido' });
        const r = await (await como(coord)).post(`/admin/certificados/${c.id}/assinar`);
        expect(r.status).toBe(409);
    });

    it('tabela de monitores: para assinar e depois assinado', async () => {
        const coord = await h.criarUsuario('coordenador');
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const vaga = await h.criarVaga({
            monitor,
            disciplina: await h.criarDisciplina(),
            emMs: -h.DIA
        });
        await h.prisma.monitoria.update({
            where: { id: vaga.id },
            data: { status: 'realizada', data_fim: new Date(vaga.horario.getTime() + 3600e3) }
        });
        const ag = await h.inscrever(aluno, vaga);
        await h.prisma.agendamento.update({ where: { id: ag.id }, data: { status: 'concluido' } });
        const c = await certificado(monitor);
        const doCoord = await como(coord);

        expect((await doCoord.get('/admin/monitores')).body.monitores[0].certificado).toBe(
            'pendente'
        );
        await doCoord.post(`/admin/certificados/${c.id}/assinar`);
        expect((await doCoord.get('/admin/monitores')).body.monitores[0].certificado).toBe(
            'assinado'
        );
    });

    it('monitor não assina nem revoga', async () => {
        const monitor = await h.criarUsuario('monitor');
        const c = await certificado(monitor);
        const doMonitor = await como(monitor);
        expect((await doMonitor.post(`/admin/certificados/${c.id}/assinar`)).status).toBe(403);
        expect(
            (
                await doMonitor.post(`/admin/certificados/${c.id}/revogar`, {
                    motivo: 'Tentando revogar.'
                })
            ).status
        ).toBe(403);
    });
});
