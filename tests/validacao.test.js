// Tarefa 9 — validação de entrada com schema (zod)
const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => {
    const prismaMock = {
        usuario: { create: jest.fn(), findFirst: jest.fn() },
        monitoria: { create: jest.fn(), findUnique: jest.fn() },
        agendamento: { create: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
        $queryRaw: jest.fn()
    };
    prismaMock.$transaction = jest.fn((callback) => callback(prismaMock));
    return prismaMock;
});

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenMonitor = gerarToken({ id: 10, tipo: 'monitor' });
const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });

const cadastroValido = {
    nome_completo: 'Ana Aluna',
    email: 'aluno.teste@exemplo.edu',
    matricula: 123456,
    senha: 'senha123',
    tipo_usuario: 'aluno'
};

describe('POST /auth/cadastro — schema e política de senha', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each([
        ['curta', 'abc12', 'mínimo 8 caracteres'],
        ['sem número', 'somenteletras', 'pelo menos um número'],
        ['sem letra', '12345678', 'pelo menos uma letra']
    ])('retorna 400 para senha %s', async (_caso, senha, trecho) => {
        const resposta = await request(app)
            .post('/auth/cadastro')
            .send({ ...cadastroValido, senha });

        expect(resposta.status).toBe(400);
        expect(resposta.body.success).toBe(false);
        expect(resposta.body.campos.senha).toContain(trecho);
        expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('retorna 400 com mensagem por campo para e-mail inválido e tipo desconhecido', async () => {
        const resposta = await request(app)
            .post('/auth/cadastro')
            .send({ ...cadastroValido, email: 'nao-e-email', tipo_usuario: 'admin' });

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos).toEqual({
            email: 'Informe um e-mail válido.',
            tipo_usuario: "O tipo de usuário deve ser 'aluno' ou 'monitor'."
        });
        expect(resposta.body.erro).toBe('Informe um e-mail válido.');
    });

    it('lista todos os campos obrigatórios ausentes', async () => {
        const resposta = await request(app).post('/auth/cadastro').send({});

        expect(resposta.status).toBe(400);
        expect(Object.keys(resposta.body.campos).sort()).toEqual(
            ['email', 'matricula', 'nome_completo', 'senha', 'tipo_usuario'].sort()
        );
        expect(resposta.body.campos.matricula).toBe('A matrícula é obrigatória.');
    });

    it('aceita matrícula como string numérica e descarta campos não declarados (ex.: pontos)', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);
        prisma.usuario.create.mockResolvedValue({ id: 1 });

        const resposta = await request(app)
            .post('/auth/cadastro')
            .send({ ...cadastroValido, matricula: '123456', pontos: 9999 });

        expect(resposta.status).toBe(201);
        const { data } = prisma.usuario.create.mock.calls[0][0];
        expect(data.matricula).toBe(123456);
        expect(data).not.toHaveProperty('pontos');
    });
});

describe('POST /auth/login — schema', () => {
    it('retorna 400 (não 401) quando faltam campos', async () => {
        const resposta = await request(app).post('/auth/login').send({ identificador: 'x' });

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos).toHaveProperty('senha');
        expect(resposta.body.campos).toHaveProperty('tipo_usuario');
    });

    it('não aplica a política de senha forte no login (contas antigas continuam entrando)', async () => {
        prisma.usuario.findFirst.mockResolvedValue(null);

        const resposta = await request(app).post('/auth/login').send({
            identificador: 'aluno.teste@exemplo.edu',
            senha: 'fraca',
            tipo_usuario: 'aluno'
        });

        // Passou do schema e chegou à checagem de credenciais
        expect(resposta.status).toBe(401);
    });
});

describe('POST /monitorias — schema', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 400 para horário fora do formato ISO e capacidade inválida', async () => {
        const resposta = await request(app)
            .post('/monitorias')
            .set('Authorization', `Bearer ${tokenMonitor}`)
            .send({ id_disciplina: 1, horario: '10/09/2026 14h', local: 'Sala 12', capacidade: 0 });

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos).toHaveProperty('horario');
        expect(resposta.body.campos).toHaveProperty('capacidade');
        expect(prisma.monitoria.create).not.toHaveBeenCalled();
    });

    it('ignora status enviado pelo cliente (vaga nasce ativa)', async () => {
        prisma.monitoria.create.mockResolvedValue({ id: 1 });

        await request(app).post('/monitorias').set('Authorization', `Bearer ${tokenMonitor}`).send({
            id_disciplina: 1,
            horario: '2026-12-10T14:00:00.000Z',
            local: 'Sala 12',
            status: 'cancelada'
        });

        expect(prisma.monitoria.create.mock.calls[0][0].data.status).toBe('ativa');
    });
});

describe('POST /agendamentos — schema', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 400 quando id_monitoria não é um número', async () => {
        const resposta = await request(app)
            .post('/agendamentos')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({ id_monitoria: 'abc', data_hora: '2026-12-10T14:00:00.000Z' });

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.id_monitoria).toBe('A monitoria selecionada é inválida.');
    });

    it('retorna 400 quando falta a data/hora', async () => {
        const resposta = await request(app)
            .post('/agendamentos')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({ id_monitoria: 5 });

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.data_hora).toBe('Informe a data/hora do agendamento.');
    });

    it('ignora status enviado pelo cliente (agendamento nasce pendente)', async () => {
        prisma.$queryRaw.mockResolvedValue([{ capacidade: 3, status: 'ativa' }]);
        prisma.agendamento.findFirst.mockResolvedValue(null);
        prisma.agendamento.count.mockResolvedValue(0);
        prisma.agendamento.create.mockResolvedValue({ id: 1 });

        const resposta = await request(app)
            .post('/agendamentos')
            .set('Authorization', `Bearer ${tokenAluno}`)
            .send({ id_monitoria: 5, data_hora: '2026-12-10T14:00:00.000Z', status: 'concluido' });

        expect(resposta.status).toBe(201);
        expect(prisma.agendamento.create.mock.calls[0][0].data.status).toBe('pendente');
    });
});
