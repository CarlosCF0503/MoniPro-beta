// Plano 14 (RF-018, RN-017): confirmar o e-mail no cadastro (rotas, regras e e-mail enviado)
const crypto = require('node:crypto');
const request = require('supertest');
const bcrypt = require('bcryptjs');

// Limite por IP folgado neste arquivo: todos os pedidos daqui vêm do mesmo IP. O limite por
// conta continua no padrão (3 por hora) e tem teste próprio.
process.env.LIMITE_PEDIDOS_SENHA_IP = '1000';
process.env.LIMITE_TENTATIVAS_AUTH = '1000';

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn()
    },
    tokenConfirmacaoEmail: { updateMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    tokenRedefinicao: { updateMany: jest.fn(), findUnique: jest.fn() },
    monitoria: {},
    agendamento: {},
    $transaction: jest.fn()
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');
const { enviados } = require('../src/services/email');
const { montar } = require('../src/services/email/modelos');

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const MENSAGEM_REENVIO =
    'Se existir uma conta esperando confirmação, enviamos um link novo para o e-mail dela.';

const usuario = (extra = {}) => ({
    id: 7,
    nome_completo: 'Diego Martins',
    email: 'diego@exemplo.edu.br',
    matricula: 2024001,
    tipo_usuario: 'aluno',
    anonimizado_em: null,
    email_confirmado_em: null,
    ...extra
});

let sequencia = 0;
const emailUnico = () => `pessoa${++sequencia}@exemplo.edu.br`;
const reenviar = (identificador = emailUnico(), tipo_usuario = 'aluno') =>
    request(app).post('/auth/email/reenviar').send({ identificador, tipo_usuario });
const confirmar = (token) => request(app).post('/auth/email/confirmar').send({ token });

let hash;
beforeAll(async () => {
    hash = await bcrypt.hash('senhaCorreta1', 4);
});

beforeEach(() => {
    jest.clearAllMocks();
    enviados.length = 0;
    delete process.env.EXIGIR_CONFIRMACAO_EMAIL;
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.tokenConfirmacaoEmail.updateMany.mockResolvedValue({ count: 0 });
    prisma.tokenConfirmacaoEmail.create.mockResolvedValue({ id: 1 });
    prisma.usuario.updateMany.mockResolvedValue({ count: 1 });
});

describe('POST /auth/cadastro manda o link de confirmação', () => {
    const cadastrar = () =>
        request(app).post('/auth/cadastro').send({
            nome_completo: 'Diego Martins',
            email: 'diego@exemplo.edu.br',
            matricula: 2024001,
            senha: 'senhaForte1',
            tipo_usuario: 'aluno'
        });

    it('cria a conta sem confirmação, guarda só o hash e envia o link de 48 horas', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);
        prisma.usuario.create.mockResolvedValue(usuario());

        const resposta = await cadastrar();

        expect(resposta.status).toBe(201);
        expect(resposta.body.mensagem).toMatch(/confirmar o seu e-mail/);
        expect(prisma.usuario.create.mock.calls[0][0].data).not.toHaveProperty(
            'email_confirmado_em'
        );
        expect(enviados).toHaveLength(1);
        const [email] = enviados;
        expect(email.para).toBe('diego@exemplo.edu.br');
        expect(email.modelo).toBe('confirmar-email');
        const link = new URL(email.dados.link);
        expect(link.pathname).toBe('/confirmar_email.html');
        const token = link.searchParams.get('token');
        expect(token).toMatch(/^[\w-]{43}$/);

        const gravado = prisma.tokenConfirmacaoEmail.create.mock.calls[0][0].data;
        expect(gravado.hash).toBe(sha256(token));
        const horas = (gravado.expira_em - Date.now()) / 3600000;
        expect(horas).toBeGreaterThan(47.9);
        expect(horas).toBeLessThanOrEqual(48);
    });

    it('conta confirmada com o mesmo e-mail continua bloqueando o cadastro (409)', async () => {
        prisma.usuario.findFirst.mockResolvedValueOnce(
            usuario({ email_confirmado_em: new Date() })
        );

        const resposta = await cadastrar();

        expect(resposta.status).toBe(409);
        expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('se o link não puder ser gerado, a conta continua criada (pede outro no login)', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);
        prisma.usuario.create.mockResolvedValue(usuario());
        prisma.$transaction.mockRejectedValue(new Error('banco fora'));

        const resposta = await cadastrar();

        expect(resposta.status).toBe(201);
        expect(enviados).toHaveLength(0);
    });
});

describe('POST /auth/login com e-mail não confirmado', () => {
    const entrar = (senha = 'senhaCorreta1') =>
        request(app)
            .post('/auth/login')
            .send({ identificador: 'diego@exemplo.edu.br', senha, tipo_usuario: 'aluno' });

    it('senha certa e conta pendente: 403 com o código email_nao_confirmado e sem cookie', async () => {
        prisma.usuario.findFirst.mockResolvedValue(usuario({ senha: hash }));

        const resposta = await entrar();

        expect(resposta.status).toBe(403);
        expect(resposta.body.codigo).toBe('email_nao_confirmado');
        expect(resposta.headers['set-cookie']).toBeUndefined();
    });

    it('senha errada e conta pendente: a mesma resposta de sempre, sem revelar a pendência', async () => {
        prisma.usuario.findFirst.mockResolvedValue(usuario({ senha: hash }));

        const resposta = await entrar('senhaErrada9');

        expect(resposta.status).toBe(401);
        expect(resposta.body.codigo).toBeUndefined();
        expect(resposta.body.erro).toBe('E-mail/matrícula ou senha incorretos.');
    });

    it('conta confirmada entra normalmente', async () => {
        prisma.usuario.findFirst.mockResolvedValue(
            usuario({ senha: hash, email_confirmado_em: new Date() })
        );

        expect((await entrar()).status).toBe(200);
    });

    it('com EXIGIR_CONFIRMACAO_EMAIL=false (só no E2E), a conta pendente entra', async () => {
        process.env.EXIGIR_CONFIRMACAO_EMAIL = 'false';
        prisma.usuario.findFirst.mockResolvedValue(usuario({ senha: hash }));

        expect((await entrar()).status).toBe(200);
    });
});

describe('POST /auth/email/confirmar', () => {
    it('token válido: consome o token e grava a confirmação só se ainda não havia', async () => {
        prisma.tokenConfirmacaoEmail.updateMany.mockResolvedValue({ count: 1 });
        prisma.tokenConfirmacaoEmail.findUnique.mockResolvedValue({ id_usuario: 7 });
        const token = 'a'.repeat(43);

        const resposta = await confirmar(token);

        expect(resposta.status).toBe(200);
        const consumo = prisma.tokenConfirmacaoEmail.updateMany.mock.calls[0][0];
        expect(consumo.where.hash).toBe(sha256(token));
        expect(consumo.where.usado_em).toBeNull();
        expect(consumo.where.expira_em.gt).toBeInstanceOf(Date);
        expect(prisma.usuario.updateMany.mock.calls[0][0].where).toEqual({
            id: 7,
            email_confirmado_em: null
        });
    });

    it('token vencido, usado ou inexistente: 410 e nada é confirmado', async () => {
        prisma.tokenConfirmacaoEmail.updateMany.mockResolvedValue({ count: 0 });

        const resposta = await confirmar('b'.repeat(43));

        expect(resposta.status).toBe(410);
        expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
    });

    it.each([[{}], [{ token: 'curto' }]])('corpo inválido %p: 400', async (corpo) => {
        expect((await request(app).post('/auth/email/confirmar').send(corpo)).status).toBe(400);
    });
});

describe('POST /auth/email/reenviar', () => {
    it('conta pendente: invalida os links abertos e manda um novo', async () => {
        prisma.usuario.findFirst.mockResolvedValue(usuario());

        const resposta = await reenviar('diego@exemplo.edu.br');

        expect(resposta.status).toBe(200);
        expect(resposta.body.mensagem).toBe(MENSAGEM_REENVIO);
        expect(prisma.tokenConfirmacaoEmail.updateMany.mock.calls[0][0].where).toEqual({
            id_usuario: 7,
            usado_em: null
        });
        expect(enviados).toHaveLength(1);
        expect(enviados[0].modelo).toBe('confirmar-email');
    });

    it('aceita a matrícula, como a tela de login', async () => {
        prisma.usuario.findFirst.mockResolvedValue(usuario());

        await reenviar('2024001');

        expect(prisma.usuario.findFirst.mock.calls[0][0].where).toEqual({
            matricula: 2024001,
            tipo_usuario: 'aluno'
        });
        expect(enviados).toHaveLength(1);
    });

    it.each([
        ['sem conta', null],
        ['conta já confirmada', usuario({ email_confirmado_em: new Date() })],
        ['conta anonimizada', usuario({ anonimizado_em: new Date() })]
    ])('%s: a mesma resposta e nenhum e-mail', async (_caso, conta) => {
        prisma.usuario.findFirst.mockResolvedValue(conta);

        const resposta = await reenviar();

        expect(resposta.status).toBe(200);
        expect(resposta.body.mensagem).toBe(MENSAGEM_REENVIO);
        expect(enviados).toHaveLength(0);
        expect(prisma.tokenConfirmacaoEmail.create).not.toHaveBeenCalled();
    });

    it('quarto pedido na mesma hora para a mesma conta: 429', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);
        const identificador = emailUnico();

        for (let i = 0; i < 3; i++) expect((await reenviar(identificador)).status).toBe(200);
        expect((await reenviar(identificador.toUpperCase())).status).toBe(429);
        // Outra conta não é afetada
        expect((await reenviar()).status).toBe(200);
    });
});

describe('Redefinir a senha pelo link confirma o e-mail (RN-009 ajustada)', () => {
    it('grava email_confirmado_em de uma conta pendente', async () => {
        prisma.tokenRedefinicao.updateMany.mockResolvedValue({ count: 1 });
        prisma.tokenRedefinicao.findUnique.mockResolvedValue({ id_usuario: 7 });
        prisma.usuario.update.mockResolvedValue({ id: 7 });

        const resposta = await request(app)
            .post('/auth/senha/redefinir')
            .send({ token: 'c'.repeat(43), senha: 'senhaNova123' });

        expect(resposta.status).toBe(200);
        expect(prisma.usuario.updateMany.mock.calls[0][0]).toMatchObject({
            where: { id: 7, email_confirmado_em: null },
            data: { email_confirmado_em: expect.any(Date) }
        });
    });
});

describe('Modelo "confirmar-email"', () => {
    it('leva o link, os prazos e escapa o nome no HTML', () => {
        const m = montar('confirmar-email', {
            nome: '<b>Ana</b> Souza',
            tipo: 'monitor',
            link: 'https://moni-pro.app.br/confirmar_email.html?token=abc',
            horas: 48
        });

        expect(m.assunto).toBe('Confirme seu e-mail no MoniPro');
        expect(m.texto).toContain('https://moni-pro.app.br/confirmar_email.html?token=abc');
        expect(m.texto).toContain('48 horas');
        expect(m.texto).toContain('7 dias');
        expect(m.html).toContain('conta de monitor');
        expect(m.html).not.toContain('<b>Ana</b>');
        expect(m.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    });
});

describe('POST /auth/email/corrigir (digitei o e-mail errado)', () => {
    const corrigir = (extra = {}) =>
        request(app)
            .post('/auth/email/corrigir')
            .send({
                identificador: '2024001',
                senha: 'senhaCorreta1',
                tipo_usuario: 'aluno',
                email_novo: 'diego@exemplo.edu.br',
                ...extra
            });

    it('senha certa e conta pendente: grava o e-mail novo e manda o link para ele', async () => {
        prisma.usuario.findFirst
            .mockResolvedValueOnce(usuario({ senha: hash, email: 'diego@exemplo.edu.bt' }))
            .mockResolvedValueOnce(null); // ninguém usa o e-mail novo

        const resposta = await corrigir();

        expect(resposta.status).toBe(200);
        expect(resposta.body.email).toBe('diego@exemplo.edu.br');
        expect(prisma.usuario.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: { email: 'diego@exemplo.edu.br' }
        });
        expect(enviados).toHaveLength(1);
        expect(enviados[0].para).toBe('diego@exemplo.edu.br');
    });

    it('senha errada: 401 de credenciais, nada muda e nenhum e-mail', async () => {
        prisma.usuario.findFirst.mockResolvedValueOnce(usuario({ senha: hash }));

        const resposta = await corrigir({ senha: 'senhaErrada9' });

        expect(resposta.status).toBe(401);
        expect(prisma.usuario.update).not.toHaveBeenCalled();
        expect(enviados).toHaveLength(0);
    });

    it('conta já confirmada: 409 e nada muda', async () => {
        prisma.usuario.findFirst.mockResolvedValueOnce(
            usuario({ senha: hash, email_confirmado_em: new Date() })
        );

        expect((await corrigir()).status).toBe(409);
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('e-mail novo já usado por outra conta do mesmo perfil: 409', async () => {
        prisma.usuario.findFirst
            .mockResolvedValueOnce(usuario({ senha: hash, email: 'diego@exemplo.edu.bt' }))
            .mockResolvedValueOnce(usuario({ id: 9 }));

        const resposta = await corrigir();

        expect(resposta.status).toBe(409);
        expect(resposta.body.erro).toBe('Este e-mail já está cadastrado como aluno.');
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
});
