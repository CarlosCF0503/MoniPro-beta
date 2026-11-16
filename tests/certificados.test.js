// Certificados (RF-005), PR 2: regra das horas e elegibilidade. O banco real fica com
// tests/integracao/certificados.int.test.js.
jest.mock('../src/repositories/certificadoRepository');

const request = require('supertest');
const repo = require('../src/repositories/certificadoRepository');
const certificadoService = require('../src/services/certificadoService');
const { minutosDaSessao, resumirCargaHoraria } = require('../src/utils/cargaHoraria');
const { minimoMinutosCertificado } = require('../src/config/certificados');
const { gerarToken } = require('./helpers/token');
const app = require('../src/app');

const AGORA = new Date('2026-11-12T12:00:00.000Z');
const H = 60 * 60 * 1000;
const vaga = (extra = {}) => ({
    horario: new Date('2026-11-02T18:00:00.000Z'),
    data_fim: new Date('2026-11-02T19:30:00.000Z'),
    status: 'realizada',
    disciplina: 'Cálculo I',
    confirmadas: 1,
    ...extra
});

beforeEach(() => jest.clearAllMocks());

describe('Quanto vale uma sessão', () => {
    it.each([
        [90, 90],
        [240, 240],
        [300, 240], // 5h conta como 4h
        [-30, 0] // término antes do início (dado antigo) não desconta
    ])('%i minutos valem %i', (duracao, esperado) => {
        const inicio = new Date('2026-11-02T18:00:00.000Z');
        expect(minutosDaSessao(inicio, new Date(inicio.getTime() + duracao * 60000))).toBe(
            esperado
        );
    });
});

describe('Quais sessões contam', () => {
    it('finalizada com pelo menos uma presença dos dois lados conta inteira', () => {
        const r = resumirCargaHoraria([vaga({ confirmadas: 1 })], AGORA);
        expect(r).toMatchObject({ minutos: 90, sessoes: 1 });
    });

    it('3 inscritos e só 1 confirmado: conta a sessão inteira, uma vez', () => {
        expect(resumirCargaHoraria([vaga({ confirmadas: 1 })], AGORA).minutos).toBe(90);
    });

    it('finalizada sem nenhuma presença dupla não conta e vira pendência', () => {
        const r = resumirCargaHoraria([vaga({ confirmadas: 0 })], AGORA);
        expect(r).toMatchObject({
            minutos: 0,
            sessoes: 0,
            pendentes: { sem_presenca: 1, a_finalizar: 0 }
        });
    });

    it('horário passou e não foi finalizada: pendência "a finalizar"', () => {
        const r = resumirCargaHoraria(
            [vaga({ status: 'ativa', data_fim: null, horario: new Date(AGORA - 2 * H) })],
            AGORA
        );
        expect(r.pendentes).toEqual({ a_finalizar: 1, sem_presenca: 0 });
    });

    it('soma por disciplina, da que tem mais horas para a que tem menos', () => {
        const r = resumirCargaHoraria(
            [
                vaga(),
                vaga({ disciplina: 'Física I', data_fim: new Date('2026-11-02T22:00:00.000Z') }),
                vaga({ disciplina: 'Cálculo I' })
            ],
            AGORA
        );
        expect(r.minutos).toBe(90 + 240 + 90);
        expect(r.por_disciplina).toEqual([
            { disciplina: 'Física I', minutos: 240, sessoes: 1 },
            { disciplina: 'Cálculo I', minutos: 180, sessoes: 2 }
        ]);
    });
});

describe('Elegibilidade', () => {
    it('semestre atual por padrão, com o mínimo de 1h', async () => {
        repo.buscarVagasDoPeriodo.mockResolvedValue([vaga()]);

        const r = await certificadoService.elegibilidade(10, undefined, AGORA);

        expect(r).toMatchObject({
            periodo: '2026.2',
            minutos: 90,
            minimo_minutos: 60,
            pode_emitir: true
        });
        const [idMonitor, limites, agora] = repo.buscarVagasDoPeriodo.mock.calls[0];
        expect(idMonitor).toBe(10);
        expect(limites).toEqual({
            inicio: new Date('2026-07-01T03:00:00.000Z'),
            fim: new Date('2027-01-01T03:00:00.000Z')
        });
        expect(agora).toBe(AGORA);
    });

    it('abaixo do mínimo não pode emitir', async () => {
        repo.buscarVagasDoPeriodo.mockResolvedValue([
            vaga({ data_fim: new Date('2026-11-02T18:45:00.000Z') })
        ]);

        expect(await certificadoService.elegibilidade(10, '2026.2', AGORA)).toMatchObject({
            minutos: 45,
            pode_emitir: false
        });
    });

    it('CERT_MINIMO_MINUTOS muda o mínimo; valor inválido volta para 60', () => {
        expect(minimoMinutosCertificado({ CERT_MINIMO_MINUTOS: '120' })).toBe(120);
        expect(minimoMinutosCertificado({ CERT_MINIMO_MINUTOS: 'x' })).toBe(60);
        expect(minimoMinutosCertificado({})).toBe(60);
    });
});

describe('GET /certificados/elegibilidade', () => {
    const pedir = (token, busca = '') => {
        const req = request(app).get('/certificados/elegibilidade' + busca);
        return token ? req.set('Cookie', `monipro_sessao=${token}`) : req;
    };

    it('sem login: 401; aluno: 403', async () => {
        expect((await pedir()).status).toBe(401);
        expect((await pedir(gerarToken({ id: 20, tipo: 'aluno' }))).status).toBe(403);
        expect(repo.buscarVagasDoPeriodo).not.toHaveBeenCalled();
    });

    it('monitor: 200 com o resumo, usando o id da sessão', async () => {
        repo.buscarVagasDoPeriodo.mockResolvedValue([]);

        const r = await pedir(gerarToken({ id: 10, tipo: 'monitor' }), '?periodo=2026.1');

        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({
            success: true,
            periodo: '2026.1',
            minutos: 0,
            pode_emitir: false
        });
        expect(repo.buscarVagasDoPeriodo.mock.calls[0][0]).toBe(10);
    });

    it.each(['2026', '2026.3', '26.1', 'abc'])('período mal formado %p: 400', async (p) => {
        const r = await pedir(gerarToken({ id: 10, tipo: 'monitor' }), '?periodo=' + p);
        expect(r.status).toBe(400);
    });
});
