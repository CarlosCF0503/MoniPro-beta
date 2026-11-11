// Editar vaga (RF-009, RN-010): o que só o Postgres real prova. A trava da linha da vaga
// (SELECT ... FOR UPDATE) é a mesma da inscrição, então reduzir os lugares e se inscrever ao
// mesmo tempo nunca deixa a vaga com mais inscritos do que lugares.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const inscritosAtivos = (vaga) =>
    h.prisma.agendamento.count({ where: { id_monitoria: vaga.id, status: { not: 'cancelado' } } });

describe('Editar vaga com inscrições acontecendo ao mesmo tempo', () => {
    it('reduzir os lugares enquanto alunos se inscrevem não deixa a vaga acima da capacidade', async () => {
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, capacidade: 5 });
        const jaInscritos = await Promise.all([1, 2].map(() => h.criarUsuario('aluno')));
        await Promise.all(jaInscritos.map((aluno) => h.inscrever(aluno, vaga)));
        const novos = await Promise.all([1, 2, 3].map(() => h.criarUsuario('aluno')));
        const cookieMonitor = await h.cookieDe(monitor);
        const cookiesNovos = await Promise.all(novos.map((aluno) => h.cookieDe(aluno)));

        const [edicao, ...inscricoes] = await Promise.all([
            request(app)
                .patch(`/monitorias/${vaga.id}`)
                .set('Cookie', cookieMonitor)
                .send({ capacidade: 3 }),
            ...cookiesNovos.map((cookie) =>
                request(app)
                    .post('/agendamentos')
                    .set('Cookie', cookie)
                    .send({ id_monitoria: vaga.id, data_hora: vaga.horario.toISOString() })
            )
        ]);

        const final = await h.prisma.monitoria.findUnique({ where: { id: vaga.id } });
        const total = await inscritosAtivos(vaga);
        expect(total).toBeLessThanOrEqual(final.capacidade);
        expect(inscricoes.every((r) => [201, 409].includes(r.status))).toBe(true);
        if (edicao.status === 200) {
            // A edição entrou com 2 ou 3 inscritos; depois dela, só cabe até completar 3
            expect(final.capacidade).toBe(3);
            expect(total).toBe(3);
        } else {
            // As inscrições chegaram antes e passaram de 3: a edição é recusada
            expect(edicao.status).toBe(409);
            expect(final.capacidade).toBe(5);
        }
    });

    it('duas edições de lugares ao mesmo tempo não deixam a vaga abaixo dos inscritos', async () => {
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, capacidade: 4 });
        const alunos = await Promise.all([1, 2, 3].map(() => h.criarUsuario('aluno')));
        await Promise.all(alunos.map((aluno) => h.inscrever(aluno, vaga)));
        const cookie = await h.cookieDe(monitor);

        const respostas = await Promise.all(
            [2, 6].map((capacidade) =>
                request(app)
                    .patch(`/monitorias/${vaga.id}`)
                    .set('Cookie', cookie)
                    .send({ capacidade })
            )
        );

        expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
        const final = await h.prisma.monitoria.findUnique({ where: { id: vaga.id } });
        expect(final.capacidade).toBe(6);
    });
});

describe('Mudança de dia, horário ou local libera o cancelamento (ajuste da RN-001)', () => {
    it('depois da mudança de horário, o aluno cancela a menos de 24h do novo início', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const outroAluno = await h.criarUsuario('aluno');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, capacidade: 2, emMs: 3 * h.DIA });
        const agendamento = await h.inscrever(aluno, vaga);
        const outro = await h.inscrever(outroAluno, vaga);
        const novoHorario = new Date(Date.now() + 2 * h.HORA);

        const edicao = await request(app)
            .patch(`/monitorias/${vaga.id}`)
            .set('Cookie', await h.cookieDe(monitor))
            .send({ horario: novoHorario.toISOString(), local: 'Laboratório 2' });
        expect(edicao.status).toBe(200);
        expect(edicao.body.liberados).toBe(2);

        const atualizado = await h.prisma.agendamento.findUnique({ where: { id: outro.id } });
        expect(atualizado.liberado_cancelar_em).not.toBeNull();
        expect(atualizado.data_hora.getTime()).toBe(novoHorario.getTime());

        const cancelamento = await request(app)
            .delete(`/agendamentos/${agendamento.id}`)
            .set('Cookie', await h.cookieDe(aluno));
        expect(cancelamento.status).toBe(200);
        expect(await inscritosAtivos(vaga)).toBe(1);
    });

    it('sem mudança de horário ou local, a regra das 24h continua valendo', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, capacidade: 2, emMs: 10 * h.HORA });
        const agendamento = await h.inscrever(aluno, vaga);

        const edicao = await request(app)
            .patch(`/monitorias/${vaga.id}`)
            .set('Cookie', await h.cookieDe(monitor))
            .send({ capacidade: 3, descricao: 'Lista 3' });
        expect(edicao.status).toBe(200);
        expect(edicao.body.liberados).toBe(0);

        const cancelamento = await request(app)
            .delete(`/agendamentos/${agendamento.id}`)
            .set('Cookie', await h.cookieDe(aluno));
        expect(cancelamento.status).toBe(400);
        expect(cancelamento.body.erro).toMatch(/24h/);
    });
});
