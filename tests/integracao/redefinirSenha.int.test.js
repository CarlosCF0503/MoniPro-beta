// RF-008 / RN-009 contra o Postgres real: o fluxo inteiro do "esqueci minha senha", o link usado
// duas vezes ao mesmo tempo e a sessão antiga derrubada depois da troca.
process.env.LIMITE_PEDIDOS_SENHA_IP = '1000';
process.env.LIMITE_PEDIDOS_SENHA_EMAIL = '1000';
process.env.LIMITE_TENTATIVAS_AUTH = '1000';

const request = require('supertest');
const app = require('../../src/app');
const { enviados } = require('../../src/services/email');
const { hashDoToken } = require('../../src/services/redefinicaoSenhaService');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(async () => {
    await h.limparBanco();
    enviados.length = 0;
});

const pedir = (usuario) =>
    request(app)
        .post('/auth/senha/esqueci')
        .send({ email: usuario.email, tipo_usuario: usuario.tipo_usuario });
const tokenDoUltimoEmail = () => new URL(enviados.at(-1).dados.link).searchParams.get('token');
const redefinir = (token, senha = 'senhaNova123') =>
    request(app).post('/auth/senha/redefinir').send({ token, senha });
const entrar = (usuario, senha) =>
    request(app)
        .post('/auth/login')
        .send({ identificador: usuario.email, senha, tipo_usuario: usuario.tipo_usuario });

describe('Recuperar senha pelo e-mail', () => {
    it('pede o link, troca a senha, derruba a sessão antiga e entra com a senha nova', async () => {
        const aluno = await h.criarUsuario('aluno');
        const cookieAntigo = await h.cookieDe(aluno);
        expect((await request(app).get('/auth/sessao').set('Cookie', cookieAntigo)).status).toBe(
            200
        );

        expect((await pedir(aluno)).status).toBe(200);
        const token = tokenDoUltimoEmail();
        const [gravado] = await h.prisma.tokenRedefinicao.findMany();
        expect(gravado.hash).toBe(hashDoToken(token));
        expect(gravado.hash).not.toBe(token);

        expect((await redefinir(token)).status).toBe(200);

        expect((await request(app).get('/auth/sessao').set('Cookie', cookieAntigo)).status).toBe(
            401
        );
        expect((await entrar(aluno, 'senhaIntegracao1')).status).toBe(401);
        expect((await entrar(aluno, 'senhaNova123')).status).toBe(200);
    });

    it('o mesmo link não funciona duas vezes', async () => {
        const aluno = await h.criarUsuario('aluno');
        await pedir(aluno);
        const token = tokenDoUltimoEmail();

        expect((await redefinir(token)).status).toBe(200);
        expect((await redefinir(token, 'outraSenha456')).status).toBe(410);
        expect((await entrar(aluno, 'senhaNova123')).status).toBe(200);
    });

    it('o mesmo link enviado duas vezes ao mesmo tempo troca a senha uma vez só', async () => {
        const aluno = await h.criarUsuario('aluno');
        await pedir(aluno);
        const token = tokenDoUltimoEmail();

        const respostas = await Promise.all([
            redefinir(token, 'primeiraSenha1'),
            redefinir(token, 'segundaSenha2')
        ]);

        expect(respostas.map((r) => r.status).sort()).toEqual([200, 410]);
        const { versao_token } = await h.prisma.usuario.findUnique({ where: { id: aluno.id } });
        expect(versao_token).toBe(1);
    });

    it('pedir um link novo invalida o anterior', async () => {
        const aluno = await h.criarUsuario('aluno');
        await pedir(aluno);
        const primeiro = tokenDoUltimoEmail();
        await pedir(aluno);
        const segundo = tokenDoUltimoEmail();

        expect(primeiro).not.toBe(segundo);
        expect((await redefinir(primeiro)).status).toBe(410);
        expect((await redefinir(segundo)).status).toBe(200);
    });

    it('link com mais de 30 minutos não vale', async () => {
        const aluno = await h.criarUsuario('aluno');
        await pedir(aluno);
        const token = tokenDoUltimoEmail();
        await h.prisma.tokenRedefinicao.updateMany({
            data: { expira_em: new Date(Date.now() - 60 * 1000) }
        });

        expect((await redefinir(token)).status).toBe(410);
    });

    it('e-mail sem conta, ou de outro tipo de conta, não gera link nem e-mail', async () => {
        const monitor = await h.criarUsuario('monitor');

        const resposta = await request(app)
            .post('/auth/senha/esqueci')
            .send({ email: monitor.email, tipo_usuario: 'aluno' });

        expect(resposta.status).toBe(200);
        expect(await h.prisma.tokenRedefinicao.count()).toBe(0);
        expect(enviados).toHaveLength(0);
    });

    it('excluir a conta (LGPD) apaga os links pendentes', async () => {
        const aluno = await h.criarUsuario('aluno');
        await pedir(aluno);
        const token = tokenDoUltimoEmail();

        const exclusao = await request(app)
            .delete('/perfil')
            .set('Cookie', await h.cookieDe(aluno))
            .set('Origin', 'https://moni-pro.app.br')
            .send({ senha: 'senhaIntegracao1' });

        expect(exclusao.status).toBe(200);
        expect(await h.prisma.tokenRedefinicao.count()).toBe(0);
        expect((await redefinir(token)).status).toBe(410);
    });
});
