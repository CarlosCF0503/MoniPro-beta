const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    monitoria: {},
    agendamento: {},
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
            tipo_usuario: 'aluno',
        });

        expect(resposta.status).toBe(201);
        expect(resposta.body.success).toBe(true);
        expect(prisma.usuario.create).toHaveBeenCalledTimes(1);
    });

    it('retorna 400 quando faltam campos obrigatórios', async () => {
        const resposta = await request(app).post('/auth/cadastro').send({ email: 'ana@exemplo.com' });

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
            tipo_usuario: 'aluno',
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
            tipo_usuario: 'aluno',
        });

        const resposta = await request(app).post('/auth/login').send({
            identificador: 'ana@exemplo.com',
            senha: 'senhaErrada',
            tipo_usuario: 'aluno',
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
            tipo_usuario: 'aluno',
        });

        const resposta = await request(app).post('/auth/login').send({
            identificador: 'ana@exemplo.com',
            senha: 'senhaCorreta',
            tipo_usuario: 'aluno',
        });

        expect(resposta.status).toBe(200);
        expect(resposta.body.success).toBe(true);
        expect(typeof resposta.body.token).toBe('string');
    });
});
