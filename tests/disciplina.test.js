const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    disciplina: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn()
    },
    usuario: { findMany: jest.fn() }
}));

const prisma = require('../src/config/bancoDeDados');
const app = require('../src/app');

const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });
const tokenMonitor = gerarToken({ id: 30, tipo: 'monitor' });

describe('GET /disciplinas (Tarefa 32)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.disciplina.findMany.mockResolvedValue([{ id: 1, nome: 'Cálculo I' }]);
    });

    it('lista as disciplinas para usuário autenticado', async () => {
        const resposta = await request(app)
            .get('/disciplinas')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.disciplinas).toEqual([{ id: 1, nome: 'Cálculo I' }]);
    });

    it('retorna 401 sem token', async () => {
        const resposta = await request(app).get('/disciplinas');

        expect(resposta.status).toBe(401);
        expect(prisma.disciplina.findMany).not.toHaveBeenCalled();
    });

    it('não expõe mais a rota pública duplicada GET /auth/disciplinas', async () => {
        const resposta = await request(app).get('/auth/disciplinas');

        expect(resposta.status).toBe(404);
        expect(prisma.disciplina.findMany).not.toHaveBeenCalled();
    });
});

describe('POST /disciplinas (cadastro de disciplina, Fase 03 P5)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.disciplina.findFirst.mockResolvedValue(null);
        prisma.disciplina.create.mockImplementation(({ data }) =>
            Promise.resolve({ id: 5, ...data })
        );
    });

    const cadastrar = (corpo, token = tokenMonitor) => {
        const req = request(app).post('/disciplinas');
        if (token) req.set('Cookie', `monipro_sessao=${token}`);
        return req.send(corpo);
    };

    it('retorna 401 sem token', async () => {
        const resposta = await cadastrar({ nome: 'Cálculo I' }, null);

        expect(resposta.status).toBe(401);
        expect(prisma.disciplina.create).not.toHaveBeenCalled();
    });

    it('retorna 403 quando um aluno tenta cadastrar', async () => {
        const resposta = await cadastrar({ nome: 'Cálculo I' }, tokenAluno);

        expect(resposta.status).toBe(403);
        expect(resposta.body).toEqual({
            success: false,
            erro: 'Acesso permitido apenas a monitores.'
        });
        expect(prisma.disciplina.create).not.toHaveBeenCalled();
    });

    it('monitor cadastra a disciplina (201) com o nome sem espaços sobrando', async () => {
        const resposta = await cadastrar({ nome: '  Estruturas   de  Dados ' });

        expect(resposta.status).toBe(201);
        expect(resposta.body).toEqual({
            success: true,
            mensagem: 'Disciplina criada com sucesso.',
            disciplina: { id: 5, nome: 'Estruturas de Dados' }
        });
        expect(prisma.disciplina.create).toHaveBeenCalledWith({
            data: { nome: 'Estruturas de Dados' }
        });
    });

    it('descarta campos não declarados no corpo', async () => {
        await cadastrar({ nome: 'Cálculo I', id: 99 });

        expect(prisma.disciplina.create).toHaveBeenCalledWith({ data: { nome: 'Cálculo I' } });
    });

    it('retorna 409 para nome repetido, sem diferenciar maiúsculas', async () => {
        prisma.disciplina.findFirst.mockResolvedValue({ id: 1, nome: 'Cálculo I' });

        const resposta = await cadastrar({ nome: 'cálculo i' });

        expect(resposta.status).toBe(409);
        expect(resposta.body.erro).toBe('Já existe uma disciplina com este nome: "Cálculo I".');
        expect(prisma.disciplina.findFirst.mock.calls[0][0].where).toEqual({
            nome: { equals: 'cálculo i', mode: 'insensitive' }
        });
        expect(prisma.disciplina.create).not.toHaveBeenCalled();
    });

    it('retorna 409 quando duas criações simultâneas esbarram na unicidade do banco', async () => {
        prisma.disciplina.create.mockRejectedValue(
            // Formato real do @prisma/adapter-pg (capturado de um Postgres 17): sem meta.target
            Object.assign(new Error('Unique constraint'), {
                code: 'P2002',
                meta: {
                    modelName: 'Disciplina',
                    driverAdapterError: {
                        cause: {
                            originalCode: '23505',
                            kind: 'UniqueConstraintViolation',
                            constraint: { index: 'disciplinas_nome_key' },
                            table: 'disciplinas'
                        }
                    }
                }
            })
        );

        const resposta = await cadastrar({ nome: 'Cálculo I' });

        expect(resposta.status).toBe(409);
        expect(resposta.body.erro).toBe('Já existe uma disciplina com este nome.');
    });

    it.each([
        ['ausente', {}, 'O nome da disciplina é obrigatório.'],
        ['só espaços', { nome: '   ' }, 'O nome da disciplina é obrigatório.'],
        ['curto demais', { nome: 'IA' }, 'O nome da disciplina deve ter pelo menos 3 caracteres.'],
        ['longo demais', { nome: 'x'.repeat(81) }, 'Deve ter no máximo 80 caracteres.'],
        ['que não é texto', { nome: 123 }, 'Deve ser um texto.']
    ])('retorna 400 para nome %s', async (_caso, corpo, mensagem) => {
        const resposta = await cadastrar(corpo);

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.nome).toBe(mensagem);
        expect(prisma.disciplina.create).not.toHaveBeenCalled();
    });

    it('aceita o nome com exatamente 80 caracteres', async () => {
        const resposta = await cadastrar({ nome: 'x'.repeat(80) });

        expect(resposta.status).toBe(201);
    });
});

describe('GET /disciplinas/:id/ranking', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.disciplina.findUnique.mockResolvedValue({ id: 1 });
        prisma.usuario.findMany.mockResolvedValue([]);
    });

    const ranking = (id = 1, token = tokenAluno) => {
        const req = request(app).get(`/disciplinas/${id}/ranking`);
        if (token) req.set('Cookie', `monipro_sessao=${token}`);
        return req;
    };

    it('retorna 401 sem token', async () => {
        const resposta = await ranking(1, null);

        expect(resposta.status).toBe(401);
        expect(prisma.usuario.findMany).not.toHaveBeenCalled();
    });

    it('retorna 400 para id que não é número', async () => {
        const resposta = await ranking('abc');

        expect(resposta.status).toBe(400);
        expect(prisma.usuario.findMany).not.toHaveBeenCalled();
    });

    it('retorna 404 quando a disciplina não existe', async () => {
        prisma.disciplina.findUnique.mockResolvedValue(null);

        const resposta = await ranking(999);

        expect(resposta.status).toBe(404);
        expect(resposta.body.erro).toBe('Disciplina não encontrada.');
        expect(prisma.usuario.findMany).not.toHaveBeenCalled();
    });

    it('devolve lista vazia quando ninguém concluiu monitoria na disciplina', async () => {
        const resposta = await ranking();

        expect(resposta.status).toBe(200);
        expect(resposta.body).toEqual({ success: true, ranking: [] });
    });

    it('devolve os alunos na ordem que o banco retorna', async () => {
        const alunos = [
            { id: 3, nome_completo: 'Carla', pontos: 30 },
            { id: 1, nome_completo: 'Ana', pontos: 10 },
            { id: 2, nome_completo: 'Bruno', pontos: 10 }
        ];
        prisma.usuario.findMany.mockResolvedValue(alunos);

        const resposta = await ranking();

        expect(resposta.body.ranking).toEqual(alunos);
    });

    it('considera só alunos com monitoria concluída na disciplina pedida', async () => {
        await ranking(7);

        const { where } = prisma.usuario.findMany.mock.calls[0][0];
        expect(where).toEqual({
            tipo_usuario: 'aluno',
            meus_agendamentos: {
                some: { status: 'concluido', monitoria: { id_disciplina: 7 } }
            }
        });
    });

    it('ordena por pontos e desempata pelo nome, limitado aos 10 primeiros', async () => {
        await ranking();

        const consulta = prisma.usuario.findMany.mock.calls[0][0];
        expect(consulta.orderBy).toEqual([{ pontos: 'desc' }, { nome_completo: 'asc' }]);
        expect(consulta.take).toBe(10);
    });

    it('não expõe e-mail, matrícula nem senha', async () => {
        await ranking();

        const { select } = prisma.usuario.findMany.mock.calls[0][0];
        expect(select).toEqual({ id: true, nome_completo: true, pontos: true });
    });
});
