// R1: restrições únicas reais do banco (RN-006 e nome da disciplina). Com o
// @prisma/adapter-pg o erro P2002 chega sem meta.target, e só um banco de verdade mostra
// se o 409 sai com a mensagem certa (o defeito corrigido em 9f698ad passou pelos mocks).
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

// /auth tem limite de 10 tentativas por IP; cada requisição usa um IP diferente
let ip = 0;
const cadastrar = (dados) =>
    request(app)
        .post('/auth/cadastro')
        .set('X-Forwarded-For', `10.0.0.${++ip}`)
        .send({ senha: 'senhaForte1', ...dados });

const ana = { nome_completo: 'Ana Fictícia', email: 'ana@integracao.invalid', matricula: 123456 };

describe('RN-006: um e-mail pode ter um perfil de aluno e um de monitor', () => {
    it('o mesmo e-mail e a mesma matrícula como aluno e como monitor: 201 nos dois', async () => {
        const comoAluno = await cadastrar({ ...ana, tipo_usuario: 'aluno' });
        const comoMonitor = await cadastrar({ ...ana, tipo_usuario: 'monitor' });

        expect(comoAluno.status).toBe(201);
        expect(comoMonitor.status).toBe(201);
        expect(await h.prisma.usuario.count({ where: { email: ana.email } })).toBe(2);
    });

    it('e-mail repetido no mesmo perfil: 409', async () => {
        await cadastrar({ ...ana, tipo_usuario: 'aluno' });
        const repetido = await cadastrar({ ...ana, matricula: 654321, tipo_usuario: 'aluno' });

        expect(repetido.status).toBe(409);
        expect(repetido.body.erro).toMatch(/e-mail/i);
    });

    it('matrícula repetida no mesmo perfil: 409', async () => {
        await cadastrar({ ...ana, tipo_usuario: 'monitor' });
        const repetida = await cadastrar({
            ...ana,
            email: 'outra@integracao.invalid',
            tipo_usuario: 'monitor'
        });

        expect(repetida.status).toBe(409);
        expect(repetida.body.erro).toMatch(/matrícula/i);
    });

    it('dois cadastros iguais ao mesmo tempo: um 201 e um 409 da restrição do banco', async () => {
        const respostas = await Promise.all([
            cadastrar({ ...ana, tipo_usuario: 'aluno' }),
            cadastrar({ ...ana, tipo_usuario: 'aluno' })
        ]);

        const [criado, recusado] = respostas.sort((a, b) => a.status - b.status);
        expect(criado.status).toBe(201);
        expect(recusado.status).toBe(409);
        // A mensagem diz qual campo repetiu, mesmo vindo do P2002 do adaptador
        expect(recusado.body.erro).toMatch(/e-mail|matrícula/i);
        expect(await h.prisma.usuario.count()).toBe(1);
    });
});

describe('Disciplina com nome único (P5)', () => {
    it('nome repetido sem diferenciar maiúsculas: 409 com o nome já salvo', async () => {
        const monitor = await h.criarUsuario('monitor');
        const cookie = await h.cookieDe(monitor);
        await request(app).post('/disciplinas').set('Cookie', cookie).send({ nome: 'Cálculo I' });

        const repetida = await request(app)
            .post('/disciplinas')
            .set('Cookie', cookie)
            .send({ nome: 'cálculo i' });

        expect(repetida.status).toBe(409);
        expect(repetida.body.erro).toContain('Cálculo I');
    });

    it('duas criações ao mesmo tempo gravam uma linha só', async () => {
        const monitor = await h.criarUsuario('monitor');
        const cookie = await h.cookieDe(monitor);

        const respostas = await Promise.all(
            [1, 2].map(() =>
                request(app).post('/disciplinas').set('Cookie', cookie).send({ nome: 'Física II' })
            )
        );

        expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
        expect(await h.prisma.disciplina.count()).toBe(1);
    });
});
