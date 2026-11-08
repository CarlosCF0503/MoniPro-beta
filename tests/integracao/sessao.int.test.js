// R1: login, sessão e revogação (P3) com a coluna versao_token de verdade.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const COOKIE = 'monipro_sessao';

function cookieDaResposta(resposta) {
    const bruto = (resposta.headers['set-cookie'] || []).find((c) => c.startsWith(`${COOKIE}=`));
    return bruto && bruto.split(';')[0];
}

describe('Sessão em cookie com revogação no "sair" (P3, R7)', () => {
    it('o token copiado antes do "sair" recebe 401 depois dele, e um novo login funciona', async () => {
        const aluno = await h.criarUsuario('aluno');
        const entrar = () =>
            request(app).post('/auth/login').set('X-Forwarded-For', '10.1.0.1').send({
                identificador: aluno.email,
                senha: 'senhaIntegracao1',
                tipo_usuario: 'aluno'
            });

        const login = await entrar();
        expect(login.status).toBe(200);
        expect(login.body.token).toBeUndefined();
        const copia = cookieDaResposta(login);
        expect(copia).toBeDefined();

        const antes = await request(app).get('/auth/sessao').set('Cookie', copia);
        expect(antes.status).toBe(200);
        expect(antes.body.usuario).toMatchObject({ id: aluno.id, tipo: 'aluno' });

        const sair = await request(app)
            .post('/auth/sair')
            .set('Cookie', copia)
            .set('Origin', 'https://moni-pro.app.br');
        expect(sair.status).toBe(200);

        const depois = await request(app).get('/perfil').set('Cookie', copia);
        expect(depois.status).toBe(401);

        const novo = cookieDaResposta(await entrar());
        expect((await request(app).get('/auth/sessao').set('Cookie', novo)).status).toBe(200);
    });

    it('login pela matrícula no perfil errado: 401 com a mesma mensagem de senha errada', async () => {
        const monitor = await h.criarUsuario('monitor');
        const tentar = (dados) =>
            request(app).post('/auth/login').set('X-Forwarded-For', '10.1.0.2').send(dados);

        const perfilErrado = await tentar({
            identificador: String(monitor.matricula),
            senha: 'senhaIntegracao1',
            tipo_usuario: 'aluno'
        });
        const senhaErrada = await tentar({
            identificador: String(monitor.matricula),
            senha: 'outraSenha9',
            tipo_usuario: 'monitor'
        });

        expect(perfilErrado.status).toBe(401);
        expect(senhaErrada.status).toBe(401);
        expect(perfilErrado.body.erro).toBe(senhaErrada.body.erro);
    });

    it('usuário removido do banco: a sessão dele deixa de valer', async () => {
        const aluno = await h.criarUsuario('aluno');
        const cookie = await h.cookieDe(aluno);
        await h.prisma.usuario.delete({ where: { id: aluno.id } });

        expect((await request(app).get('/auth/sessao').set('Cookie', cookie)).status).toBe(401);
    });
});
