// Plano 14 (RF-018, RN-017) contra o Postgres real: cadastro → link → login, o link usado duas
// vezes ao mesmo tempo, a redefinição de senha confirmando o e-mail e a retenção das contas
// pendentes.
process.env.LIMITE_PEDIDOS_SENHA_IP = '1000';
process.env.LIMITE_PEDIDOS_SENHA_EMAIL = '1000';
process.env.LIMITE_TENTATIVAS_AUTH = '1000';

const request = require('supertest');
const app = require('../../src/app');
const { enviados } = require('../../src/services/email');
const { hashDoToken } = require('../../src/utils/tokenDeUso');
const privacidadeService = require('../../src/services/privacidadeService');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(async () => {
    await h.limparBanco();
    enviados.length = 0;
});

const DIA = 24 * 60 * 60 * 1000;
const SENHA = 'senhaForte123';
let sequencia = 0;

async function cadastrar(extra = {}) {
    sequencia += 1;
    const dados = {
        nome_completo: '[FICTÍCIO] Pessoa Cadastro',
        email: `cadastro${sequencia}@integracao.invalid`,
        matricula: 800000 + sequencia,
        senha: SENHA,
        tipo_usuario: 'aluno',
        ...extra
    };
    const resposta = await request(app).post('/auth/cadastro').send(dados);
    return { resposta, dados };
}
const tokenDoUltimoEmail = () => new URL(enviados.at(-1).dados.link).searchParams.get('token');
const confirmar = (token) => request(app).post('/auth/email/confirmar').send({ token });
const entrar = (dados, senha = SENHA) =>
    request(app)
        .post('/auth/login')
        .send({ identificador: dados.email, senha, tipo_usuario: dados.tipo_usuario });

describe('Confirmar o e-mail no cadastro', () => {
    it('cadastro → login bloqueado → link do e-mail → login liberado', async () => {
        const { resposta, dados } = await cadastrar();
        expect(resposta.status).toBe(201);

        const conta = await h.prisma.usuario.findUnique({ where: { id: resposta.body.id } });
        expect(conta.email_confirmado_em).toBeNull();

        const bloqueado = await entrar(dados);
        expect(bloqueado.status).toBe(403);
        expect(bloqueado.body.codigo).toBe('email_nao_confirmado');

        const token = tokenDoUltimoEmail();
        const [gravado] = await h.prisma.tokenConfirmacaoEmail.findMany();
        expect(gravado.hash).toBe(hashDoToken(token));
        expect(gravado.hash).not.toBe(token);

        expect((await confirmar(token)).status).toBe(200);
        expect((await entrar(dados)).status).toBe(200);
    });

    it('o mesmo link não funciona duas vezes', async () => {
        await cadastrar();
        const token = tokenDoUltimoEmail();

        expect((await confirmar(token)).status).toBe(200);
        expect((await confirmar(token)).status).toBe(410);
    });

    it('o mesmo link enviado duas vezes ao mesmo tempo: só uma confirmação passa', async () => {
        await cadastrar();
        const token = tokenDoUltimoEmail();

        const respostas = await Promise.all([confirmar(token), confirmar(token)]);

        expect(respostas.map((r) => r.status).sort()).toEqual([200, 410]);
    });

    it('pedir outro link invalida o anterior; só a conta pendente recebe e-mail', async () => {
        const { dados } = await cadastrar();
        const primeiro = tokenDoUltimoEmail();

        const reenvio = await request(app)
            .post('/auth/email/reenviar')
            .send({ identificador: String(dados.matricula), tipo_usuario: 'aluno' });
        expect(reenvio.status).toBe(200);
        const segundo = tokenDoUltimoEmail();
        expect(segundo).not.toBe(primeiro);

        expect((await confirmar(primeiro)).status).toBe(410);
        expect((await confirmar(segundo)).status).toBe(200);

        // Já confirmada: mesma resposta, nenhum e-mail novo
        const quantos = enviados.length;
        const deNovo = await request(app)
            .post('/auth/email/reenviar')
            .send({ identificador: dados.email, tipo_usuario: 'aluno' });
        expect(deNovo.status).toBe(200);
        expect(enviados).toHaveLength(quantos);
    });

    it('link com mais de 48 horas não vale', async () => {
        await cadastrar();
        const token = tokenDoUltimoEmail();
        await h.prisma.tokenConfirmacaoEmail.updateMany({
            data: { expira_em: new Date(Date.now() - 60 * 1000) }
        });

        expect((await confirmar(token)).status).toBe(410);
    });

    it('redefinir a senha pelo link do e-mail também confirma a conta pendente', async () => {
        const { dados } = await cadastrar();

        await request(app)
            .post('/auth/senha/esqueci')
            .send({ email: dados.email, tipo_usuario: 'aluno' });
        const token = tokenDoUltimoEmail();
        expect(
            (
                await request(app)
                    .post('/auth/senha/redefinir')
                    .send({ token, senha: 'outraSenha456' })
            ).status
        ).toBe(200);

        expect((await entrar(dados, 'outraSenha456')).status).toBe(200);
    });

    it('excluir a conta (LGPD) apaga os links de confirmação', async () => {
        const aluno = await h.criarUsuario('aluno');
        await h.prisma.usuario.update({
            where: { id: aluno.id },
            data: { email_confirmado_em: null }
        });
        await request(app)
            .post('/auth/email/reenviar')
            .send({ identificador: aluno.email, tipo_usuario: 'aluno' });
        expect(await h.prisma.tokenConfirmacaoEmail.count()).toBe(1);

        const exclusao = await request(app)
            .delete('/perfil')
            .set('Cookie', await h.cookieDe(aluno))
            .set('Origin', 'https://moni-pro.app.br')
            .send({ senha: 'senhaIntegracao1' });

        expect(exclusao.status).toBe(200);
        expect(await h.prisma.tokenConfirmacaoEmail.count()).toBe(0);
    });
});

describe('Digitei o e-mail errado', () => {
    const corrigir = (dados, extra = {}) =>
        request(app)
            .post('/auth/email/corrigir')
            .send({
                identificador: String(dados.matricula),
                senha: SENHA,
                tipo_usuario: dados.tipo_usuario,
                email_novo: 'certo@integracao.invalid',
                ...extra
            });

    it('com a senha: troca o e-mail, o link antigo morre e o novo libera o login', async () => {
        const { dados } = await cadastrar({ email: 'digitado.errado@integracao.invalid' });
        const tokenAntigo = tokenDoUltimoEmail();

        const resposta = await corrigir(dados);

        expect(resposta.status).toBe(200);
        expect(enviados.at(-1).para).toBe('certo@integracao.invalid');
        expect((await confirmar(tokenAntigo)).status).toBe(410);
        expect((await confirmar(tokenDoUltimoEmail())).status).toBe(200);
        expect(
            (await entrar({ email: 'certo@integracao.invalid', tipo_usuario: 'aluno' })).status
        ).toBe(200);
    });

    it('sem a senha certa ninguém mexe no cadastro pendente de outra pessoa', async () => {
        const { dados } = await cadastrar();

        const resposta = await corrigir(dados, { senha: 'chuteDoAtacante1' });

        expect(resposta.status).toBe(401);
        const conta = await h.prisma.usuario.findFirst({ where: { matricula: dados.matricula } });
        expect(conta.email).toBe(dados.email);
    });
});

describe('Retenção das contas que não confirmaram o e-mail (RN-017)', () => {
    it('apaga a pendente com 8 dias e libera e-mail e matrícula; mantém a de 6 dias e a confirmada', async () => {
        const agora = new Date();
        const velha = await h.criarUsuario('aluno', {
            email_confirmado_em: null,
            criado_em: new Date(agora.getTime() - 8 * DIA)
        });
        const recente = await h.criarUsuario('aluno', {
            email_confirmado_em: null,
            criado_em: new Date(agora.getTime() - 6 * DIA)
        });
        const confirmada = await h.criarUsuario('aluno', {
            criado_em: new Date(agora.getTime() - 400 * DIA)
        });

        const simulacao = await privacidadeService.aplicarRetencao({ agora });
        expect(simulacao.contasPendentes).toBe(1);
        expect(await h.prisma.usuario.count()).toBe(3);

        const r = await privacidadeService.aplicarRetencao({ aplicar: true, agora });
        expect(r.contasPendentes).toBe(1);
        const restantes = (await h.prisma.usuario.findMany({ select: { id: true } })).map(
            (u) => u.id
        );
        expect(restantes.sort()).toEqual([recente.id, confirmada.id].sort());

        // O e-mail e a matrícula da conta apagada podem ser usados num cadastro novo
        const { resposta } = await cadastrar({ email: velha.email, matricula: velha.matricula });
        expect(resposta.status).toBe(201);
    });
});
