// R1: corridas que os mocks não conseguem provar, porque dependem das travas do Postgres
// (SELECT ... FOR UPDATE) e das transações reais.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

describe('Presença confirmada pelos dois lados ao mesmo tempo (P2, RN-008)', () => {
    it('aluno e monitor confirmando juntos concluem uma vez e creditam os pontos uma vez', async () => {
        // Cinco inscrições na mesma vaga e as dez confirmações disparadas de uma vez, para que
        // as transações realmente se cruzem
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, emMs: -2 * h.HORA, capacidade: 5 });
        const alunos = await Promise.all([1, 2, 3, 4, 5].map(() => h.criarUsuario('aluno')));
        const agendamentos = await Promise.all(alunos.map((aluno) => h.inscrever(aluno, vaga)));
        const cookieMonitor = await h.cookieDe(monitor);
        const cookiesAlunos = await Promise.all(alunos.map((aluno) => h.cookieDe(aluno)));

        const respostas = await Promise.all(
            agendamentos.flatMap((ag, i) => [
                request(app).patch(`/agendamentos/${ag.id}/concluir`).set('Cookie', cookieMonitor),
                request(app)
                    .patch(`/agendamentos/${ag.id}/presenca`)
                    .set('Cookie', cookiesAlunos[i])
            ])
        );

        expect(respostas.every((r) => r.status === 200)).toBe(true);
        // Em cada par, só quem confirmou por último concluiu
        for (let i = 0; i < respostas.length; i += 2) {
            const concluidos = [respostas[i], respostas[i + 1]].filter((r) => r.body.concluido);
            expect(concluidos).toHaveLength(1);
        }
        const finais = await h.prisma.agendamento.findMany({ where: { id_monitoria: vaga.id } });
        expect(finais.every((ag) => ag.status === 'concluido')).toBe(true);
        expect(finais.every((ag) => ag.presenca_aluno_em && ag.presenca_monitor_em)).toBe(true);
        expect(await h.pontosDe(monitor)).toBe(5 * 10);
        for (const aluno of alunos) expect(await h.pontosDe(aluno)).toBe(2);
    });

    it('a mesma confirmação enviada duas vezes ao mesmo tempo grava só uma', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, emMs: -2 * h.HORA });
        const agendamento = await h.inscrever(aluno, vaga);
        const cookie = await h.cookieDe(monitor);

        const respostas = await Promise.all(
            [1, 2].map(() =>
                request(app).patch(`/agendamentos/${agendamento.id}/concluir`).set('Cookie', cookie)
            )
        );

        expect(respostas.map((r) => r.status).sort()).toEqual([200, 400]);
        expect(await h.pontosDe(monitor)).toBe(0); // falta o aluno confirmar
    });

    it('não confirma presença numa vaga cancelada, mesmo com a inscrição ativa', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({
            monitor,
            disciplina,
            emMs: -2 * h.HORA,
            status: 'cancelada'
        });
        const agendamento = await h.inscrever(aluno, vaga);

        const resposta = await request(app)
            .patch(`/agendamentos/${agendamento.id}/concluir`)
            .set('Cookie', await h.cookieDe(monitor));

        expect(resposta.status).toBe(400);
        expect(await h.pontosDe(monitor)).toBe(0);
    });
});

describe('Capacidade da vaga com inscrições simultâneas (CT-09)', () => {
    it('cinco alunos disputando a última vaga: só um entra, os outros recebem 409', async () => {
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, capacidade: 2 });
        await h.inscrever(await h.criarUsuario('aluno'), vaga); // ocupa 1 de 2

        const alunos = await Promise.all([1, 2, 3, 4, 5].map(() => h.criarUsuario('aluno')));
        const cookies = await Promise.all(alunos.map((a) => h.cookieDe(a)));
        const respostas = await Promise.all(
            cookies.map((cookie) =>
                request(app)
                    .post('/agendamentos')
                    .set('Cookie', cookie)
                    .send({ id_monitoria: vaga.id })
            )
        );

        const status = respostas.map((r) => r.status).sort();
        expect(status).toEqual([201, 409, 409, 409, 409]);
        expect(await h.prisma.agendamento.count({ where: { id_monitoria: vaga.id } })).toBe(2);
    });

    it('o mesmo aluno clicando duas vezes fica com uma inscrição só', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, capacidade: 3 });
        const cookie = await h.cookieDe(aluno);

        const respostas = await Promise.all(
            [1, 2].map(() =>
                request(app)
                    .post('/agendamentos')
                    .set('Cookie', cookie)
                    .send({ id_monitoria: vaga.id })
            )
        );

        expect(respostas.map((r) => r.status).sort()).toEqual([201, 400]);
        expect(await h.prisma.agendamento.count({ where: { id_aluno: aluno.id } })).toBe(1);
    });
});
