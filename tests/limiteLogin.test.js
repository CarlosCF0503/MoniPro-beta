// Login: só as tentativas que falham contam, por conta e por IP. Limites baixos neste arquivo
// para testar o 429 sem dezenas de pedidos.
process.env.LIMITE_FALHAS_LOGIN_CONTA = '3';
process.env.LIMITE_FALHAS_LOGIN_IP = '5';

const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: { findFirst: jest.fn(), update: jest.fn() }
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

let hash;
beforeAll(async () => {
    hash = await bcrypt.hash('senhaCorreta', 4);
});
beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findFirst.mockResolvedValue({
        id: 1,
        nome_completo: 'Ana',
        senha: hash,
        tipo_usuario: 'aluno',
        email_confirmado_em: new Date(),
        versao_token: 0
    });
    prisma.usuario.update.mockResolvedValue({});
});

const login = (identificador, senha, ip) =>
    request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ identificador, senha, tipo_usuario: 'aluno' });

it('login certo não gasta o limite: uma sala inteira entra pelo mesmo IP', async () => {
    for (let i = 0; i < 12; i++) {
        expect((await login(`aluno${i}@exemplo.com`, 'senhaCorreta', '203.0.113.1')).status).toBe(
            200
        );
    }
});

it('por conta: depois de 3 falhas, a 4ª tentativa é recusada mesmo vindo de outro IP', async () => {
    const conta = 'alvo@exemplo.com';
    for (let i = 1; i <= 3; i++) {
        expect((await login(conta, 'errada', `203.0.113.${10 + i}`)).status).toBe(401);
    }

    const bloqueada = await login(conta.toUpperCase(), 'senhaCorreta', '203.0.113.20');

    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.erro).toMatch(/Muitas tentativas/);
    // Outra conta não é afetada
    expect((await login('outra@exemplo.com', 'senhaCorreta', '203.0.113.21')).status).toBe(200);
});

it('por IP: depois de 5 falhas em contas diferentes, o IP espera', async () => {
    const ip = '203.0.113.50';
    for (let i = 0; i < 5; i++) {
        expect((await login(`varredura${i}@exemplo.com`, 'errada', ip)).status).toBe(401);
    }

    expect((await login('nova@exemplo.com', 'senhaCorreta', ip)).status).toBe(429);
});
