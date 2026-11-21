// Plano 7 (RF-012, RN-014), contra o Postgres real: perfil coordenador, rotas /admin/* e
// auditoria. As contas em si estão em tests/painelCoordenacao.test.js.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');
const script = require('../../scripts/criar-coordenador');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
const get = async (usuario, url) =>
    request(app)
        .get(url)
        .set('Cookie', await h.cookieDe(usuario));

/** Sessão finalizada de 90 min há `diasAtras` dias, com as inscrições dadas. */
async function sessao(monitor, disciplina, diasAtras, inscricoes) {
    const vaga = await h.criarVaga({
        monitor,
        disciplina,
        emMs: -diasAtras * h.DIA,
        capacidade: 3
    });
    await h.prisma.monitoria.update({
        where: { id: vaga.id },
        data: { status: 'realizada', data_fim: new Date(vaga.horario.getTime() + 90 * 60000) }
    });
    for (const [aluno, situacao] of inscricoes) {
        const ag = await h.inscrever(aluno, vaga);
        const agora = new Date();
        const data =
            situacao === 'presente'
                ? { status: 'concluido', presenca_aluno_em: agora, presenca_monitor_em: agora }
                : situacao === 'falta'
                  ? { ausente_em: agora }
                  : {};
        await h.prisma.agendamento.update({ where: { id: ag.id }, data });
    }
    return vaga;
}

describe('Perfil coordenador', () => {
    it('o banco aceita o tipo coordenador e o login dele funciona', async () => {
        const coord = await h.criarUsuario('coordenador');
        const r = await request(app).post('/auth/login').set('Origin', ORIGEM).send({
            identificador: coord.email,
            senha: 'senhaIntegracao1',
            tipo_usuario: 'coordenador'
        });
        expect(r.status).toBe(200);
        expect(r.body.usuario).toMatchObject({ id: coord.id, tipo: 'coordenador' });
    });

    it('o cadastro público não cria coordenador', async () => {
        const r = await request(app).post('/auth/cadastro').set('Origin', ORIGEM).send({
            nome_completo: 'Tentativa',
            email: 'tentativa@integracao.invalid',
            matricula: 777,
            senha: 'senhaForte1',
            tipo_usuario: 'coordenador'
        });
        expect(r.status).toBe(400);
        expect(await h.prisma.usuario.count({ where: { tipo_usuario: 'coordenador' } })).toBe(0);
    });

    it('o script cria a conta confirmada e registra na auditoria', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        try {
            await script.main(
                [
                    '--nome',
                    'Profa. Teste',
                    '--email',
                    'coord@integracao.invalid',
                    '--matricula',
                    '4242',
                    '--aplicar'
                ],
                h.prisma
            );
        } finally {
            log.mockRestore();
        }
        const coord = await h.prisma.usuario.findFirst({ where: { tipo_usuario: 'coordenador' } });
        expect(coord).toMatchObject({ email: 'coord@integracao.invalid', matricula: 4242 });
        expect(coord.email_confirmado_em).toBeInstanceOf(Date);

        const r = await get(coord, '/admin/auditoria');
        expect(r.status).toBe(200);
        expect(r.body.registros).toEqual([
            expect.objectContaining({ acao: 'criar_coordenador', usuario: 'Profa. Teste' })
        ]);
    });
});

describe('Rotas /admin/*', () => {
    it('aluno e monitor recebem 403', async () => {
        const aluno = await h.criarUsuario('aluno');
        const monitor = await h.criarUsuario('monitor');
        for (const url of ['/admin/resumo', '/admin/monitores', '/admin/auditoria']) {
            expect((await get(aluno, url)).status).toBe(403);
            expect((await get(monitor, url)).status).toBe(403);
        }
    });

    it('indicadores e tabela de monitores batem com uma contagem manual', async () => {
        const coord = await h.criarUsuario('coordenador');
        const ana = await h.criarUsuario('monitor');
        const bia = await h.criarUsuario('monitor');
        const [a1, a2, a3] = [
            await h.criarUsuario('aluno'),
            await h.criarUsuario('aluno'),
            await h.criarUsuario('aluno')
        ];
        const calc = await h.criarDisciplina('Cálculo I');
        const fis = await h.criarDisciplina('Física I');

        // Ana: duas sessões com presença (a1 e a2 na primeira, a1 na segunda) e uma falta de a3
        await sessao(ana, calc, 2, [
            [a1, 'presente'],
            [a2, 'presente'],
            [a3, 'falta']
        ]);
        await sessao(ana, calc, 1, [[a1, 'presente']]);
        // Bia: finalizou, mas ninguém confirmou: não conta como sessão
        await sessao(bia, fis, 1, [[a2, 'pendente']]);
        // Lista de espera não é inscrição
        const futura = await h.criarVaga({ monitor: bia, disciplina: fis, emMs: -3 * h.HORA });
        await h.prisma.agendamento.create({
            data: {
                id_aluno: a3.id,
                id_monitoria: futura.id,
                data_hora: futura.horario,
                status: 'em_espera'
            }
        });

        const r = await get(coord, '/admin/resumo');
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({
            sessoes: 2,
            minutos: 180,
            alunos: 2,
            faltas: 1,
            taxa_presenca: 0.75,
            por_disciplina: [{ nome: 'Cálculo I', minutos: 180 }],
            inscricoes: {
                presentes: 3,
                faltas: 1,
                sem_confirmacao: 1,
                canceladas_monitor: 0,
                bloqueados: 0
            }
        });

        const m = await get(coord, '/admin/monitores');
        expect(m.body.monitores.map((x) => [x.id, x.sessoes, x.minutos, x.presenca])).toEqual([
            [ana.id, 2, 180, 0.75],
            [bia.id, 0, 0, null]
        ]);
    });

    it('certificado válido do semestre aparece na tabela; o revogado não', async () => {
        const coord = await h.criarUsuario('coordenador');
        const ana = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        await sessao(ana, await h.criarDisciplina(), 1, [[aluno, 'presente']]);
        const { periodoDe } = require('../../src/utils/periodo');
        const base = { id_usuario: ana.id, periodo: periodoDe(), carga_minutos: 90, snapshot: {} };
        await h.prisma.certificado.create({
            data: { ...base, codigo: 'REVOGADO0000000000000000AA', situacao: 'revogado' }
        });
        let r = await get(coord, '/admin/monitores');
        expect(r.body.monitores[0].certificado).toBe('nenhum');
        await h.prisma.certificado.create({
            data: { ...base, codigo: 'VALIDO000000000000000000AA' }
        });
        r = await get(coord, '/admin/monitores');
        expect(r.body.monitores[0].certificado).toBe('pendente');
    });
});
