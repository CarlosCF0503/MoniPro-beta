// Tarefa 8 — tratamento de erro robusto (classes de erro + middleware central)
const request = require('supertest');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => ({
    usuario: {},
    monitoria: { create: jest.fn(), findUnique: jest.fn() },
    agendamento: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() }
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
            .set('Authorization', `Bearer ${tokenAluno}`);

        expect(resposta.status).toBe(404);
        expect(resposta.body).toEqual({ success: false, erro: 'Agendamento não encontrado.' });
    });

    it('retorna 404 quando a vaga de monitoria da URL não existe', async () => {
        prisma.monitoria.findUnique.mockResolvedValue(null);

        const resposta = await request(app)
            .put('/monitorias/999/cancelar')
            .set('Authorization', `Bearer ${tokenMonitor}`);

        expect(resposta.status).toBe(404);
        expect(resposta.body.erro).toBe('Vaga de monitoria não encontrada.');
    });

    it('traduz violação de FK (P2003) em 400 com o campo da disciplina', async () => {
        prisma.monitoria.create.mockRejectedValue(
            Object.assign(new Error('fk'), { code: 'P2003' })
        );

        const resposta = await request(app)
            .post('/monitorias')
            .set('Authorization', `Bearer ${tokenMonitor}`)
            .send({ id_disciplina: 99, horario: '2026-12-10T14:00:00.000Z', local: 'Sala 12' });

        expect(resposta.status).toBe(400);
        expect(resposta.body.campos.id_disciplina).toBe('A disciplina informada não existe.');
    });

    it('retorna 500 com mensagem genérica e loga o erro inesperado sem expô-lo', async () => {
        prisma.agendamento.findMany.mockRejectedValue(new Error('connection refused 10.0.0.5'));

        const resposta = await request(app)
            .get('/agendamentos')
            .set('Authorization', `Bearer ${tokenAluno}`);

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
