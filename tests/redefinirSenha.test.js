// RF-008 / RN-009: recuperar a senha pelo e-mail (rotas, regras e e-mail enviado)
const crypto = require('node:crypto');
const request = require('supertest');
const bcrypt = require('bcryptjs');

// Limite por IP folgado neste arquivo: todos os pedidos daqui vêm do mesmo IP. O limite por
// e-mail continua no padrão (3 por hora) e tem teste próprio.
process.env.LIMITE_PEDIDOS_SENHA_IP = '1000';
process.env.LIMITE_TENTATIVAS_AUTH = '1000';

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    tokenRedefinicao: { updateMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    monitoria: {},
    agendamento: {},
    $transaction: jest.fn()
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');
const { enviados } = require('../src/services/email');

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const MENSAGEM =
    'Se existir uma conta com esse e-mail, enviamos um link para criar uma senha nova.';

const usuario = (extra = {}) => ({
    id: 7,
    nome_completo: 'Diego Martins',
    email: 'diego@exemplo.edu.br',
    tipo_usuario: 'aluno',
    anonimizado_em: null,
    ...extra
});

let sequencia = 0;
const emailUnico = () => `pessoa${++sequencia}@exemplo.edu.br`;
const pedir = (email = emailUnico(), tipo_usuario = 'aluno') =>
    request(app).post('/auth/senha/esqueci').send({ email, tipo_usuario });

beforeEach(() => {
    jest.clearAllMocks();
    enviados.length = 0;
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.tokenRedefinicao.updateMany.mockResolvedValue({ count: 0 });
    prisma.tokenRedefinicao.create.mockResolvedValue({ id: 1 });
});

describe('POST /auth/senha/esqueci', () => {
    it('com conta: guarda só o hash do token e envia o link por e-mail', async () => {
        prisma.usuario.findFirst.mockResolvedValue(usuario());

        const resposta = await pedir('diego@exemplo.edu.br');

        expect(resposta.status).toBe(200);
        expect(resposta.body.mensagem).toBe(MENSAGEM);
        expect(enviados).toHaveLength(1);
        const [email] = enviados;
        expect(email.para).toBe('diego@exemplo.edu.br');
        expect(email.modelo).toBe('redefinir-senha');
        const token = new URL(email.dados.link).searchParams.get('token');
        expect(token).toMatch(/^[\w-]{43}$/);

        const gravado = prisma.tokenRedefinicao.create.mock.calls[0][0].data;
        expect(gravado.hash).toBe(sha256(token));
        expect(gravado.hash).not.toContain(token);
        const minutos = (gravado.expira_em - Date.now()) / 60000;
        expect(minutos).toBeGreaterThan(29);
        expect(minutos).toBeLessThanOrEqual(30);
    });

    it('um pedido novo invalida os links anteriores ainda não usados', async () => {
        prisma.usuario.findFirst.mockResolvedValue(usuario());

        await pedir();

        const invalidar = prisma.tokenRedefinicao.updateMany.mock.calls[0][0];
        expect(invalidar.where).toEqual({ id_usuario: 7, usado_em: null });
        expect(invalidar.data.usado_em).toBeInstanceOf(Date);
    });

    it('sem conta: mesma resposta, nada gravado e nenhum e-mail', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);

        const resposta = await pedir();

        expect(resposta.status).toBe(200);
        expect(resposta.body.mensagem).toBe(MENSAGEM);
        expect(prisma.tokenRedefinicao.create).not.toHaveBeenCalled();
        expect(enviados).toHaveLength(0);
    });

    it('conta anonimizada (LGPD) não recebe link', async () => {
        prisma.usuario.findFirst.mockResolvedValue(usuario({ anonimizado_em: new Date() }));

        const resposta = await pedir();

        expect(resposta.body.mensagem).toBe(MENSAGEM);
        expect(enviados).toHaveLength(0);
    });

    it('busca a conta pelo e-mail e pelo tipo informado', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);

        await pedir('ana@exemplo.edu.br', 'monitor');

        expect(prisma.usuario.findFirst.mock.calls[0][0].where).toEqual({
            email: 'ana@exemplo.edu.br',
            tipo_usuario: 'monitor'
        });
    });

    it.each([
        [{ email: 'sem-arroba', tipo_usuario: 'aluno' }],
        [{ email: 'ana@exemplo.edu.br', tipo_usuario: 'diretor' }],
        [{}]
    ])('retorna 400 para corpo inválido %p', async (corpo) => {
        const resposta = await request(app).post('/auth/senha/esqueci').send(corpo);

        expect(resposta.status).toBe(400);
        expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    });

    it('limita a 3 pedidos por hora para a mesma conta, exista ela ou não', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);
        const email = emailUnico();

        const status = [];
        for (let i = 0; i < 4; i++) status.push((await pedir(email)).status);

        expect(status).toEqual([200, 200, 200, 429]);
        // Outra conta não é afetada pelo limite da primeira
        expect((await pedir()).status).toBe(200);
    });
});

describe('POST /auth/senha/redefinir', () => {
    const TOKEN = 'a'.repeat(43);
    const redefinir = (corpo) => request(app).post('/auth/senha/redefinir').send(corpo);

    it('com link válido: grava a senha nova (bcrypt) e encerra as sessões', async () => {
        prisma.tokenRedefinicao.updateMany.mockResolvedValue({ count: 1 });
        prisma.tokenRedefinicao.findUnique.mockResolvedValue({ id_usuario: 7 });

        const resposta = await redefinir({ token: TOKEN, senha: 'novaSenha9' });

        expect(resposta.status).toBe(200);
        const consumo = prisma.tokenRedefinicao.updateMany.mock.calls[0][0];
        expect(consumo.where.hash).toBe(sha256(TOKEN));
        expect(consumo.where.usado_em).toBeNull();
        expect(consumo.where.expira_em.gt).toBeInstanceOf(Date);

        const { where, data } = prisma.usuario.update.mock.calls[0][0];
        expect(where).toEqual({ id: 7 });
        expect(data.versao_token).toEqual({ increment: 1 });
        expect(await bcrypt.compare('novaSenha9', data.senha)).toBe(true);
        // O cookie de sessão deste navegador também é apagado
        expect(resposta.headers['set-cookie'].join(';')).toMatch(/monipro_sessao=;/);
    });

    it('link vencido, já usado ou trocado por outro mais novo: 410 e a senha não muda', async () => {
        prisma.tokenRedefinicao.updateMany.mockResolvedValue({ count: 0 });

        const resposta = await redefinir({ token: TOKEN, senha: 'novaSenha9' });

        expect(resposta.status).toBe(410);
        expect(resposta.body.erro).toMatch(/não vale mais/);
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it.each([
        ['curta1', /8 caracteres/],
        ['somenteletras', /número/],
        ['12345678', /letra/]
    ])('senha nova fraca (%s): 400 com a regra do cadastro', async (senha, regra) => {
        const resposta = await redefinir({ token: TOKEN, senha });

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.senha).toMatch(regra);
        expect(prisma.tokenRedefinicao.updateMany).not.toHaveBeenCalled();
    });

    it('token ausente ou curto demais: 400 sem consultar o banco', async () => {
        expect((await redefinir({ senha: 'novaSenha9' })).status).toBe(400);
        expect((await redefinir({ token: 'abc', senha: 'novaSenha9' })).status).toBe(400);
        expect(prisma.tokenRedefinicao.updateMany).not.toHaveBeenCalled();
    });
});
