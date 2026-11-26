// Tarefa 8 — tratamento de erro robusto (classes de erro + middleware central)
const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    // Plano 7: a disciplina das vagas existe e está aprovada
    disciplina: { findUnique: async () => ({ id: 1, status: 'aprovada', id_criador: null }) },
    usuario: {},
    monitoria: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    agendamento: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    // O cancelamento roda numa transação: o mock repassa o próprio cliente como `tx`
    $transaction: async (fn) => fn(require('../src/config/bancoDeDados'))
}));

jest.mock('../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const prisma = require('../src/config/bancoDeDados');
const logger = require('../src/utils/logger');
const app = require('../src/app');

const tokenMonitor = gerarToken({ id: 10, tipo: 'monitor' });
const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });

describe('middleware central de erro', () => {
    beforeEach(() => jest.clearAllMocks());

    it('retorna 404 quando o agendamento da URL não existe', async () => {
        prisma.agendamento.findUnique.mockResolvedValue(null);

        const resposta = await request(app)
            .delete('/agendamentos/999')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        expect(resposta.status).toBe(404);
        expect(resposta.body).toEqual({ success: false, erro: 'Agendamento não encontrado.' });
    });

    it('retorna 404 quando a vaga de monitoria da URL não existe', async () => {
        prisma.monitoria.findUnique.mockResolvedValue(null);

        const resposta = await request(app)
            .put('/monitorias/999/cancelar')
            .set('Cookie', `monipro_sessao=${tokenMonitor}`);

        expect(resposta.status).toBe(404);
        expect(resposta.body.erro).toBe('Vaga de monitoria não encontrada.');
    });

    // Antes, "abc" virava NaN no parseInt, o Prisma recusava e a resposta era 500
    it.each([
        ['delete', '/agendamentos/abc', tokenAluno, 'Inscrição não encontrada.'],
        ['patch', '/agendamentos/12abc/presenca', tokenAluno, 'Inscrição não encontrada.'],
        ['patch', '/agendamentos/0/concluir', tokenMonitor, 'Inscrição não encontrada.'],
        ['patch', '/agendamentos/-3/ausencia', tokenMonitor, 'Inscrição não encontrada.'],
        ['put', '/monitorias/abc/cancelar', tokenMonitor, 'Monitoria não encontrada.'],
        ['put', '/monitorias/1e3/cancelar-proximas', tokenMonitor, 'Monitoria não encontrada.'],
        ['post', '/monitorias/1.5/espera', tokenAluno, 'Monitoria não encontrada.'],
        ['patch', '/monitorias/abc', tokenMonitor, 'Monitoria não encontrada.'],
        [
            'patch',
            '/monitorias/99999999999999999999/finalizar',
            tokenMonitor,
            'Monitoria não encontrada.'
        ]
    ])('%s %s com id que não é inteiro positivo: 404, sem erro no log', async (m, url, tk, msg) => {
        const resposta = await request(app)[m](url).set('Cookie', `monipro_sessao=${tk}`).send({});

        expect(resposta.status).toBe(404);
        expect(resposta.body).toEqual({ success: false, erro: msg });
        expect(prisma.agendamento.findUnique).not.toHaveBeenCalled();
        expect(prisma.monitoria.findUnique).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('401 sem sessão segue o formato do tratador central', async () => {
        const resposta = await request(app).get('/agendamentos');

        expect(resposta.status).toBe(401);
        expect(resposta.body).toEqual({
            success: false,
            erro: 'Sessão não encontrada. Faça login.'
        });
    });

    it('traduz violação de FK (P2003) em 400 com o campo da disciplina', async () => {
        prisma.monitoria.create.mockRejectedValue(
            Object.assign(new Error('fk'), { code: 'P2003' })
        );

        const resposta = await request(app)
            .post('/monitorias')
            .set('Cookie', `monipro_sessao=${tokenMonitor}`)
            .send({ id_disciplina: 99, horario: '2026-12-10T14:00:00.000Z', local: 'Sala 12' });

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.id_disciplina).toBe('A disciplina informada não existe.');
    });

    it('retorna 500 com mensagem genérica e loga o erro inesperado sem expô-lo', async () => {
        prisma.agendamento.findMany.mockRejectedValue(new Error('connection refused 10.0.0.5'));

        const resposta = await request(app)
            .get('/agendamentos')
            .set('Cookie', `monipro_sessao=${tokenAluno}`);

        expect(resposta.status).toBe(500);
        expect(resposta.body.erro).toBe('Ocorreu um erro inesperado. Tente novamente.');
        expect(JSON.stringify(resposta.body)).not.toContain('10.0.0.5');
        expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('retorna 400 em JSON quando o corpo é um JSON malformado', async () => {
        const resposta = await request(app)
            .post('/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"identificador": ');

        expect(resposta.status).toBe(400);
        expect(resposta.body.erro).toBe('Corpo da requisição não é um JSON válido.');
    });
});
