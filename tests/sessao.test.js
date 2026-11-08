// P3 (R7): sessão em cookie httpOnly, validade de 2 h (D2), revogação no "sair" e origem.
process.env.ALLOWED_ORIGINS = 'https://moni-pro.app.br';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    monitoria: {},
    agendamento: {}
}));

const prisma = require('../src/config/bancoDeDados');
const sessaoRepository = require('../src/repositories/sessaoRepository');
const { lerCookie } = require('../src/utils/cookies');
const app = require('../src/app');

const COOKIE = 'monipro_sessao';
const comCookie = (token) => `${COOKIE}=${token}`;

describe('POST /auth/login — cookie de sessão', () => {
    let hash;
    beforeAll(async () => {
        hash = await bcrypt.hash('senhaCorreta1', 4);
    });
    beforeEach(() => jest.clearAllMocks());

    const entrar = () =>
        request(app).post('/auth/login').send({
            identificador: 'ana@exemplo.com',
            senha: 'senhaCorreta1',
            tipo_usuario: 'aluno'
        });

    it('grava o token num cookie HttpOnly, Secure, SameSite=Strict de 2 h', async () => {
        prisma.usuario.findFirst.mockResolvedValue({
            id: 7,
            nome_completo: 'Ana Aluna',
            email: 'ana@exemplo.com',
            senha: hash,
            tipo_usuario: 'aluno',
            versao_token: 3
        });

        const resposta = await entrar();

        expect(resposta.status).toBe(200);
        const cookie = (resposta.headers['set-cookie'] || []).find((c) =>
            c.startsWith(`${COOKIE}=`)
        );
        expect(cookie).toBeDefined();
        expect(cookie).toMatch(/; HttpOnly/);
        expect(cookie).toMatch(/; Secure/);
        expect(cookie).toMatch(/; SameSite=Strict/);
        expect(cookie).toMatch(/; Path=\//);
        expect(cookie).toMatch(/; Max-Age=7200/);

        const token = cookie.split(';')[0].slice(COOKIE.length + 1);
        const conteudo = jwt.decode(token);
        expect(conteudo).toMatchObject({ id: 7, tipo: 'aluno', v: 3 });
        expect(conteudo.exp - conteudo.iat).toBe(7200);
        // O e-mail não vai mais no token
        expect(conteudo.email).toBeUndefined();
    });

    it('não grava cookie quando as credenciais estão erradas', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);

        const resposta = await entrar();

        expect(resposta.status).toBe(401);
        expect(resposta.headers['set-cookie']).toBeUndefined();
    });
});

describe('Autenticação pelo cookie', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sessaoRepository.buscarVersao.mockResolvedValue(0);
    });

    it('GET /auth/sessao devolve quem está logado a partir do cookie', async () => {
        const token = gerarToken({ id: 7, nome_completo: 'Ana Aluna', tipo: 'aluno' });

        const resposta = await request(app).get('/auth/sessao').set('Cookie', comCookie(token));

        expect(resposta.status).toBe(200);
        expect(resposta.body.usuario).toEqual({ id: 7, nome: 'Ana Aluna', tipo: 'aluno' });
        expect(resposta.headers['cache-control']).toBe('no-store');
        expect(sessaoRepository.buscarVersao).toHaveBeenCalledWith(7);
    });

    it('retorna 401 sem cookie e sem cabeçalho Authorization', async () => {
        const resposta = await request(app).get('/auth/sessao');

        expect(resposta.status).toBe(401);
    });

    it('retorna 401 com um token adulterado no cookie', async () => {
        const token = gerarToken({ id: 7, tipo: 'aluno' }) + 'x';

        const resposta = await request(app).get('/auth/sessao').set('Cookie', comCookie(token));

        expect(resposta.status).toBe(401);
    });

    it('retorna 401 quando a versão do token não é a atual (sessão revogada)', async () => {
        sessaoRepository.buscarVersao.mockResolvedValue(1);
        const token = gerarToken({ id: 7, tipo: 'aluno' }); // sem "v": conta como versão 0

        const resposta = await request(app).get('/auth/sessao').set('Cookie', comCookie(token));

        expect(resposta.status).toBe(401);
        expect(resposta.body.erro).toMatch(/Sessão encerrada/);
    });

    it('retorna 401 quando o usuário do token não existe mais', async () => {
        sessaoRepository.buscarVersao.mockResolvedValue(null);
        const token = gerarToken({ id: 99, tipo: 'aluno' });

        const resposta = await request(app).get('/auth/sessao').set('Cookie', comCookie(token));

        expect(resposta.status).toBe(401);
    });

    it('ainda aceita Authorization: Bearer durante a transição', async () => {
        const token = gerarToken({ id: 7, tipo: 'aluno' });

        const resposta = await request(app)
            .get('/auth/sessao')
            .set('Authorization', `Bearer ${token}`);

        expect(resposta.status).toBe(200);
    });
});

describe('POST /auth/sair — revogação', () => {
    let versao;
    beforeEach(() => {
        jest.clearAllMocks();
        versao = 0;
        sessaoRepository.buscarVersao.mockImplementation(async () => versao);
        sessaoRepository.incrementarVersao.mockImplementation(async () => {
            versao += 1;
        });
    });

    it('apaga o cookie e incrementa a versão do usuário', async () => {
        const token = gerarToken({ id: 7, tipo: 'aluno' });

        const resposta = await request(app).post('/auth/sair').set('Cookie', comCookie(token));

        expect(resposta.status).toBe(200);
        expect(sessaoRepository.incrementarVersao).toHaveBeenCalledWith(7);
        const cookie = resposta.headers['set-cookie'].find((c) => c.startsWith(`${COOKIE}=`));
        expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
        expect(cookie).toMatch(/; HttpOnly/);
    });

    it('um token copiado antes do "sair" recebe 401 depois dele', async () => {
        const copia = gerarToken({ id: 7, tipo: 'aluno' });
        const antes = await request(app).get('/auth/sessao').set('Cookie', comCookie(copia));
        expect(antes.status).toBe(200);

        await request(app).post('/auth/sair').set('Cookie', comCookie(copia));

        const pelaCopiaNoCookie = await request(app)
            .get('/auth/sessao')
            .set('Cookie', comCookie(copia));
        const pelaCopiaNoBearer = await request(app)
            .get('/auth/sessao')
            .set('Authorization', `Bearer ${copia}`);
        expect(pelaCopiaNoCookie.status).toBe(401);
        expect(pelaCopiaNoBearer.status).toBe(401);
    });

    it('retorna 401 sem sessão e não mexe na versão', async () => {
        const resposta = await request(app).post('/auth/sair');

        expect(resposta.status).toBe(401);
        expect(sessaoRepository.incrementarVersao).not.toHaveBeenCalled();
    });
});

describe('Origem das requisições (CSRF)', () => {
    const token = gerarToken({ id: 30, tipo: 'monitor' });
    beforeEach(() => {
        jest.clearAllMocks();
        sessaoRepository.buscarVersao.mockResolvedValue(0);
    });

    it.each([
        ['post', '/agendamentos'],
        ['patch', '/agendamentos/1/concluir'],
        ['put', '/monitorias/1/cancelar'],
        ['delete', '/agendamentos/1']
    ])('%s %s vindo de outro site recebe 403', async (metodo, rota) => {
        const resposta = await request(app)
            [metodo](rota)
            .set('Origin', 'https://site-malicioso.example')
            .set('Cookie', comCookie(token))
            .send({});

        expect(resposta.status).toBe(403);
        // Barrada antes de chegar à rota: nem a sessão foi consultada
        expect(sessaoRepository.buscarVersao).not.toHaveBeenCalled();
    });

    it('a origem do próprio sistema passa e recebe permissão para credenciais', async () => {
        const resposta = await request(app)
            .get('/auth/sessao')
            .set('Origin', 'https://moni-pro.app.br')
            .set('Cookie', comCookie(token));

        expect(resposta.status).toBe(200);
        expect(resposta.headers['access-control-allow-origin']).toBe('https://moni-pro.app.br');
        expect(resposta.headers['access-control-allow-credentials']).toBe('true');
    });
});

describe('lerCookie', () => {
    const req = (cookie) => ({ headers: cookie === undefined ? {} : { cookie } });

    it('acha o cookie entre outros', () => {
        expect(lerCookie(req('a=1; monipro_sessao=abc.def; b=2'), COOKIE)).toBe('abc.def');
    });
    it('não confunde nomes parecidos', () => {
        expect(lerCookie(req('xmonipro_sessao=1; monipro_sessao_x=2'), COOKIE)).toBeNull();
    });
    it('devolve null sem cabeçalho', () => {
        expect(lerCookie(req(undefined), COOKIE)).toBeNull();
    });
    it('não quebra com valor mal codificado', () => {
        expect(lerCookie(req('monipro_sessao=%E0%A4%A'), COOKIE)).toBe('%E0%A4%A');
    });
});
