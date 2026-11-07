const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    monitoria: {},
    agendamento: {}
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

describe('POST /auth/cadastro', () => {
    beforeEach(() => jest.clearAllMocks());

    it('cria a conta e retorna 201 quando os dados são válidos', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);
        prisma.usuario.create.mockResolvedValue({ id: 1 });

        const resposta = await request(app).post('/auth/cadastro').send({
            nome_completo: 'Ana Aluna',
            email: 'ana@exemplo.com',
            matricula: 12345,
            senha: 'senha123',
            tipo_usuario: 'aluno'
        });

        expect(resposta.status).toBe(201);
        expect(resposta.body.success).toBe(true);
        expect(prisma.usuario.create).toHaveBeenCalledTimes(1);
    });

    it('retorna 400 quando faltam campos obrigatórios', async () => {
        const resposta = await request(app)
            .post('/auth/cadastro')
            .send({ email: 'ana@exemplo.com' });

        expect(resposta.status).toBe(400);
        expect(prisma.usuario.create).not.toHaveBeenCalled();
    });
});

describe('POST /auth/login', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 401 para usuário inexistente', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);

        const resposta = await request(app).post('/auth/login').send({
            identificador: 'naoexiste@exemplo.com',
            senha: 'qualquer',
            tipo_usuario: 'aluno'
        });

        expect(resposta.status).toBe(401);
        expect(resposta.body.success).toBe(false);
    });

    it('retorna 401 quando a senha está incorreta', async () => {
        const hash = await bcrypt.hash('senhaCorreta', 10);
        prisma.usuario.findFirst.mockResolvedValue({
            id: 1,
            nome_completo: 'Ana Aluna',
            email: 'ana@exemplo.com',
            senha: hash,
            tipo_usuario: 'aluno'
        });

        const resposta = await request(app).post('/auth/login').send({
            identificador: 'ana@exemplo.com',
            senha: 'senhaErrada',
            tipo_usuario: 'aluno'
        });

        expect(resposta.status).toBe(401);
        expect(resposta.body.success).toBe(false);
    });

    it('retorna 200 e um token quando as credenciais estão corretas', async () => {
        const hash = await bcrypt.hash('senhaCorreta', 10);
        prisma.usuario.findFirst.mockResolvedValue({
            id: 1,
            nome_completo: 'Ana Aluna',
            email: 'ana@exemplo.com',
            senha: hash,
            tipo_usuario: 'aluno'
        });

        const resposta = await request(app).post('/auth/login').send({
            identificador: 'ana@exemplo.com',
            senha: 'senhaCorreta',
            tipo_usuario: 'aluno'
        });

        expect(resposta.status).toBe(200);
        expect(resposta.body.success).toBe(true);
        expect(typeof resposta.body.token).toBe('string');
    });
});

describe('POST /auth/login — sem enumeração de usuários e sem dado pessoal no log (R5 e R6)', () => {
    const logger = require('../src/utils/logger');
    // Cada requisição simula um IP diferente: o authLimiter (10 tentativas/15 min por IP)
    // é compartilhado por todo o arquivo e bloquearia os testes deste bloco com 429.
    let ip = 0;
    const login = (identificador, senha = 'senhaErrada', tipo_usuario = 'aluno') =>
        request(app)
            .post('/auth/login')
            .set('X-Forwarded-For', `10.0.0.${++ip}`)
            .send({ identificador, senha, tipo_usuario });

    let hash;
    beforeAll(async () => {
        hash = await bcrypt.hash('senhaCorreta', 10);
    });
    beforeEach(() => jest.clearAllMocks());

    it('usuário inexistente, senha errada e perfil errado recebem a mesma mensagem', async () => {
        prisma.usuario.findFirst.mockResolvedValueOnce(null);
        const inexistente = await login('naoexiste@exemplo.com');

        prisma.usuario.findFirst.mockResolvedValueOnce({
            id: 1,
            senha: hash,
            tipo_usuario: 'aluno'
        });
        const senhaErrada = await login('ana@exemplo.com');

        prisma.usuario.findFirst.mockResolvedValueOnce({
            id: 1,
            senha: hash,
            tipo_usuario: 'monitor'
        });
        const perfilErrado = await login('ana@exemplo.com', 'senhaCorreta');

        for (const resposta of [inexistente, senhaErrada, perfilErrado]) {
            expect(resposta.status).toBe(401);
        }
        expect(senhaErrada.body.erro).toBe(inexistente.body.erro);
        expect(perfilErrado.body.erro).toBe(inexistente.body.erro);
    });

    it('roda o bcrypt mesmo quando o usuário não existe (tempo de resposta não revela a conta)', async () => {
        prisma.usuario.findFirst.mockResolvedValueOnce(null);
        const compare = jest.spyOn(bcrypt, 'compare');

        await login('naoexiste@exemplo.com');

        expect(compare).toHaveBeenCalledTimes(1);
        compare.mockRestore();
    });

    it('matrícula não numérica retorna 401 sem consultar o banco', async () => {
        const resposta = await login('abc123');

        expect(resposta.status).toBe(401);
        expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    });

    it('registra a falha de login sem o e-mail completo', async () => {
        prisma.usuario.findFirst.mockResolvedValueOnce(null);
        const warn = jest.spyOn(logger, 'warn');

        await login('ana.silva@exemplo.com');

        const [dados] = warn.mock.calls[0];
        expect(dados.identificador).toBe('a***@exemplo.com');
        expect(JSON.stringify(warn.mock.calls)).not.toContain('ana.silva');
        warn.mockRestore();
    });
});

describe('mascararIdentificador', () => {
    const { mascararIdentificador } = require('../src/utils/mascararIdentificador');

    it.each([
        ['ana.silva@exemplo.com', 'a***@exemplo.com'],
        ['2320041', '***41'],
        ['7', '***'],
        ['', '***'],
        [undefined, '***']
    ])('%p → %p', (entrada, esperado) => {
        expect(mascararIdentificador(entrada)).toBe(esperado);
    });
});

// RN-006 como o sistema funciona hoje: aluno e monitor são perfis separados. O mesmo e-mail
// (ou matrícula) pode existir uma vez em cada perfil, mas não duas vezes no mesmo perfil.
describe('POST /auth/cadastro — RN-006 (perfis separados)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.usuario.create.mockResolvedValue({ id: 2 });
    });

    const dados = (campos = {}) => ({
        nome_completo: 'Ana Aluna',
        email: 'ana@exemplo.com',
        matricula: 12345,
        senha: 'senha123',
        tipo_usuario: 'monitor',
        ...campos
    });

    it('aceita como monitor o e-mail e a matrícula de quem já é aluno (201)', async () => {
        // Nenhum monitor com esse e-mail nem com essa matrícula
        prisma.usuario.findFirst.mockResolvedValue(null);

        const resposta = await request(app).post('/auth/cadastro').send(dados());

        expect(resposta.status).toBe(201);
        // As duas buscas são feitas dentro do perfil pedido, não no sistema inteiro
        expect(prisma.usuario.findFirst).toHaveBeenNthCalledWith(1, {
            where: { email: 'ana@exemplo.com', tipo_usuario: 'monitor' }
        });
        expect(prisma.usuario.findFirst).toHaveBeenNthCalledWith(2, {
            where: { matricula: 12345, tipo_usuario: 'monitor' }
        });
        expect(prisma.usuario.create).toHaveBeenCalledTimes(1);
    });

    it('retorna 409 para e-mail repetido no mesmo perfil', async () => {
        prisma.usuario.findFirst.mockResolvedValueOnce({ id: 1, tipo_usuario: 'monitor' });

        const resposta = await request(app).post('/auth/cadastro').send(dados());

        expect(resposta.status).toBe(409);
        expect(resposta.body.erro).toBe('Este e-mail já está cadastrado como monitor.');
        expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('retorna 409 para matrícula repetida no mesmo perfil', async () => {
        prisma.usuario.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 1, tipo_usuario: 'aluno' });

        const resposta = await request(app)
            .post('/auth/cadastro')
            .send(dados({ email: 'outro@exemplo.com', tipo_usuario: 'aluno' }));

        expect(resposta.status).toBe(409);
        expect(resposta.body.erro).toBe('Esta matrícula já está cadastrada como aluno.');
        expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('retorna 409 quando dois cadastros simultâneos esbarram na unicidade do banco', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);
        prisma.usuario.create.mockRejectedValue(
            Object.assign(new Error('Unique constraint'), {
                code: 'P2002',
                meta: { target: ['email'] }
            })
        );

        const resposta = await request(app).post('/auth/cadastro').send(dados());

        expect(resposta.status).toBe(409);
        expect(resposta.body.erro).toBe('Este e-mail já está cadastrado.');
    });
});
