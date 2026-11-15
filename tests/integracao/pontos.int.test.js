// Plano 5 (RN-008 revisada, RF-011) contra o Postgres real: presença vira evento, o saldo bate
// com a soma dos eventos, o ranking separa disciplinas e semestres e só lista monitores.
const request = require('supertest');
const app = require('../../src/app');
const { periodoDe } = require('../../src/utils/periodo');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

async function presencaDupla({ monitor, aluno, disciplina }) {
    const vaga = await h.criarVaga({ monitor, disciplina, emMs: -2 * h.HORA, capacidade: 5 });
    const ag = await h.inscrever(aluno, vaga);
    await request(app)
        .patch(`/agendamentos/${ag.id}/concluir`)
        .set('Cookie', await h.cookieDe(monitor));
    await request(app)
        .patch(`/agendamentos/${ag.id}/presenca`)
        .set('Cookie', await h.cookieDe(aluno));
    return { vaga, ag };
}
const somaEventos = async (usuario) =>
    (
        await h.prisma.eventoPontuacao.aggregate({
            where: { id_usuario: usuario.id },
            _sum: { pontos: true }
        })
    )._sum.pontos || 0;
const ranking = async (disciplina, quem) =>
    request(app)
        .get(`/disciplinas/${disciplina.id}/ranking`)
        .set('Cookie', await h.cookieDe(quem));

describe('Pontos como eventos', () => {
    it('presença dupla grava dois eventos e o saldo é igual à soma dos eventos', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const disciplina = await h.criarDisciplina('Cálculo I');

        const { ag } = await presencaDupla({ monitor, aluno, disciplina });

        const eventos = await h.prisma.eventoPontuacao.findMany({ orderBy: { id: 'asc' } });
        expect(eventos.map((e) => [e.tipo, e.pontos, e.id_disciplina, e.id_agendamento])).toEqual([
            ['sessao_monitor', 10, disciplina.id, ag.id],
            ['presenca_aluno', 2, disciplina.id, ag.id]
        ]);
        expect(eventos[0].periodo).toBe(periodoDe());
        expect(await h.pontosDe(monitor)).toBe(10);
        expect(await somaEventos(monitor)).toBe(10);
        expect(await h.pontosDe(aluno)).toBe(2);
        expect(await somaEventos(aluno)).toBe(2);
    });

    it('confirmar a mesma presença de novo não cria outro evento', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const { ag } = await presencaDupla({
            monitor,
            aluno,
            disciplina: await h.criarDisciplina()
        });

        const deNovo = await request(app)
            .patch(`/agendamentos/${ag.id}/presenca`)
            .set('Cookie', await h.cookieDe(aluno));

        expect(deNovo.status).toBe(400);
        expect(await h.prisma.eventoPontuacao.count()).toBe(2);
        expect(await h.pontosDe(aluno)).toBe(2);
    });
});

describe('Ranking por disciplina e semestre', () => {
    it('pontos em Cálculo não aparecem em Física, e o ranking não lista alunos', async () => {
        const ana = await h.criarUsuario('monitor', { nome_completo: 'Ana Ribeiro' });
        const aluno = await h.criarUsuario('aluno');
        const calculo = await h.criarDisciplina('Cálculo I');
        const fisica = await h.criarDisciplina('Física I');
        await presencaDupla({ monitor: ana, aluno, disciplina: calculo });

        const emCalculo = await ranking(calculo, aluno);
        const emFisica = await ranking(fisica, aluno);

        expect(emCalculo.status).toBe(200);
        expect(emCalculo.body.ranking).toEqual([
            { posicao: 1, nome: 'Ana Ribeiro', pontos: 10, sessoes: 0, minutos: 0, voce: false }
        ]);
        expect(emFisica.body.ranking).toEqual([]);
    });

    it('conta monitorias finalizadas e horas, e marca "você" para o próprio monitor', async () => {
        const ana = await h.criarUsuario('monitor', { nome_completo: 'Ana Ribeiro' });
        const calculo = await h.criarDisciplina('Cálculo I');
        const { vaga } = await presencaDupla({
            monitor: ana,
            aluno: await h.criarUsuario('aluno'),
            disciplina: calculo
        });
        await h.prisma.monitoria.update({
            where: { id: vaga.id },
            data: {
                status: 'realizada',
                data_fim: new Date(new Date(vaga.horario).getTime() + 90 * 60 * 1000)
            }
        });

        const r = await ranking(calculo, ana);

        expect(r.body.ranking[0]).toMatchObject({ sessoes: 1, minutos: 90, voce: true });
    });

    it('pontos de um semestre anterior e de conta anonimizada não entram', async () => {
        const ana = await h.criarUsuario('monitor', { nome_completo: 'Ana Ribeiro' });
        const removido = await h.criarUsuario('monitor', { anonimizado_em: new Date() });
        const calculo = await h.criarDisciplina('Cálculo I');
        await h.prisma.eventoPontuacao.createMany({
            data: [
                {
                    id_usuario: ana.id,
                    tipo: 'sessao_monitor',
                    pontos: 50,
                    id_disciplina: calculo.id,
                    periodo: '2025.1',
                    chave: 'antigo'
                },
                {
                    id_usuario: removido.id,
                    tipo: 'sessao_monitor',
                    pontos: 30,
                    id_disciplina: calculo.id,
                    periodo: periodoDe(),
                    chave: 'removido'
                }
            ]
        });

        expect((await ranking(calculo, ana)).body.ranking).toEqual([]);
    });
});

describe('Extrato', () => {
    it('cada um vê só o próprio extrato, com a posição entre os alunos da disciplina', async () => {
        const monitor = await h.criarUsuario('monitor');
        const calculo = await h.criarDisciplina('Cálculo I');
        const diego = await h.criarUsuario('aluno');
        const bruna = await h.criarUsuario('aluno');
        await presencaDupla({ monitor, aluno: diego, disciplina: calculo });
        await presencaDupla({ monitor, aluno: bruna, disciplina: calculo });
        await presencaDupla({ monitor, aluno: bruna, disciplina: calculo });

        const r = await request(app)
            .get('/pontos/extrato')
            .set('Cookie', await h.cookieDe(diego));

        expect(r.status).toBe(200);
        expect(r.body.saldo).toBe(2);
        expect(r.body.eventos).toEqual([
            expect.objectContaining({
                texto: 'Presença confirmada',
                disciplina: 'Cálculo I',
                pontos: 2
            })
        ]);
        expect(r.body.posicao).toEqual({ disciplina: 'Cálculo I', lugar: 2, total: 2 });
    });
});
