// Contra o Postgres real: a trava da vaga reconhece o monitor dela mesmo pela conta de aluno
// (mesma matrícula ou mesmo e-mail), e um aluno qualquer continua se inscrevendo.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
const inscrever = async (usuario, vaga, rota = '/agendamentos') =>
    request(app)
        .post(rota)
        .set('Cookie', await h.cookieDe(usuario))
        .set('Origin', ORIGEM)
        .send({ id_monitoria: vaga.id });

async function vagaDe(monitor) {
    const disciplina = await h.criarDisciplina();
    return await h.criarVaga({ monitor, disciplina, capacidade: 2 });
}

describe('Inscrição na própria vaga', () => {
    it('conta de aluno com a mesma matrícula do monitor: 403 e nenhuma inscrição', async () => {
        const monitor = await h.criarUsuario('monitor');
        const vaga = await vagaDe(monitor);
        const mesmaPessoa = await h.criarUsuario('aluno', { matricula: monitor.matricula });

        const r = await inscrever(mesmaPessoa, vaga);

        expect(r.status).toBe(403);
        expect(await h.prisma.agendamento.count()).toBe(0);
    });

    it('conta de aluno com o mesmo e-mail (maiúsculas não importam): 403', async () => {
        const monitor = await h.criarUsuario('monitor');
        const vaga = await vagaDe(monitor);
        const mesmaPessoa = await h.criarUsuario('aluno', { email: monitor.email.toUpperCase() });

        expect((await inscrever(mesmaPessoa, vaga)).status).toBe(403);
    });

    it('lista de espera da própria vaga lotada: 403', async () => {
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        const vaga = await h.criarVaga({ monitor, disciplina, capacidade: 1 });
        await h.inscrever(await h.criarUsuario('aluno'), vaga);
        const mesmaPessoa = await h.criarUsuario('aluno', { matricula: monitor.matricula });

        const r = await inscrever(mesmaPessoa, vaga, `/monitorias/${vaga.id}/espera`);

        expect(r.status).toBe(403);
        expect(await h.prisma.agendamento.count()).toBe(1);
    });

    it('a conta de monitor não se inscreve em vaga nenhuma', async () => {
        const vaga = await vagaDe(await h.criarUsuario('monitor'));

        expect((await inscrever(await h.criarUsuario('monitor'), vaga)).status).toBe(403);
    });

    it('outro aluno continua se inscrevendo normalmente', async () => {
        const vaga = await vagaDe(await h.criarUsuario('monitor'));

        const r = await inscrever(await h.criarUsuario('aluno'), vaga);

        expect(r.status).toBe(201);
    });
});
