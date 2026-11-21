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
const pontuacaoService = require('../src/services/pontuacaoService');

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
            mensagem: expect.stringMatching(/^Disciplina enviada para a coordenação/),
            disciplina: { id: 5, nome: 'Estruturas de Dados', status: 'pendente', id_criador: 30 }
        });
        // Plano 7: nasce pendente, com quem criou
        expect(prisma.disciplina.create).toHaveBeenCalledWith({
            data: {
                nome: 'Estruturas de Dados',
                status: 'pendente',
                id_criador: expect.any(Number)
            }
        });
    });

    it('descarta campos não declarados no corpo', async () => {
        await cadastrar({ nome: 'Cálculo I', id: 99 });

        expect(prisma.disciplina.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ nome: 'Cálculo I', status: 'pendente' })
        });
        expect(prisma.disciplina.create.mock.calls[0][0].data).not.toHaveProperty('id');
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

    // Plano 5: as regras do ranking (só monitores, por disciplina e semestre) estão em
    // tests/pontos.test.js e na integração; aqui, a rota passa o pedido e devolve o resultado
    it('devolve o ranking do semestre e marca quem está vendo', async () => {
        const espiao = jest.spyOn(pontuacaoService, 'ranking').mockResolvedValue({
            periodo: '2026.2',
            ranking: [
                {
                    posicao: 1,
                    nome: 'Ana Ribeiro',
                    pontos: 20,
                    sessoes: 2,
                    minutos: 120,
                    voce: false
                }
            ]
        });

        const resposta = await ranking(1);

        expect(resposta.status).toBe(200);
        expect(resposta.body).toEqual({
            success: true,
            periodo: '2026.2',
            ranking: [
                {
                    posicao: 1,
                    nome: 'Ana Ribeiro',
                    pontos: 20,
                    sessoes: 2,
                    minutos: 120,
                    voce: false
                }
            ]
        });
        expect(espiao).toHaveBeenCalledWith(1, expect.any(Number));
        espiao.mockRestore();
    });
});
