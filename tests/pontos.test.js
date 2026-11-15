// Plano 5 (RN-008 revisada, RF-011): semestre, extrato e ranking. O banco real fica com
// tests/integracao/pontos.int.test.js.
jest.mock('../src/repositories/pontuacaoRepository');

const request = require('supertest');
const repo = require('../src/repositories/pontuacaoRepository');
const pontuacaoService = require('../src/services/pontuacaoService');
const { periodoDe, limitesDoPeriodo, nomeDoPeriodo } = require('../src/utils/periodo');
const { gerarToken } = require('./helpers/token');
const app = require('../src/app');

const AGORA = new Date('2026-11-12T12:00:00.000Z'); // 2026.2

beforeEach(() => jest.clearAllMocks());

describe('Semestre do ranking (jan–jun e jul–dez, fuso de São Paulo)', () => {
    it.each([
        ['2026-01-01T03:00:00.000Z', '2026.1'],
        ['2026-06-30T23:00:00.000Z', '2026.1'], // 20h de 30/06 em São Paulo
        ['2026-07-01T02:59:00.000Z', '2026.1'], // 23h59 de 30/06 em São Paulo
        ['2026-07-01T03:00:00.000Z', '2026.2'],
        ['2027-01-01T02:00:00.000Z', '2026.2'] // 23h de 31/12 em São Paulo
    ])('%s fica em %s', (data, periodo) => {
        expect(periodoDe(new Date(data))).toBe(periodo);
    });

    it('limites e nome do semestre', () => {
        expect(limitesDoPeriodo('2026.2')).toEqual({
            inicio: new Date('2026-07-01T03:00:00.000Z'),
            fim: new Date('2027-01-01T03:00:00.000Z')
        });
        expect(limitesDoPeriodo('2026.1').fim).toEqual(new Date('2026-07-01T03:00:00.000Z'));
        expect(nomeDoPeriodo('2026.2')).toBe('2º semestre de 2026');
    });
});

describe('Crédito da presença', () => {
    it('grava +10 do monitor e +2 do aluno com disciplina, semestre e chave por inscrição', async () => {
        await pontuacaoService.creditarPresenca(
            { idAgendamento: 42, idMonitor: 1, idAluno: 4, idDisciplina: 3 },
            'tx',
            AGORA
        );

        expect(repo.registrar.mock.calls).toEqual([
            [
                {
                    id_usuario: 1,
                    tipo: 'sessao_monitor',
                    pontos: 10,
                    id_disciplina: 3,
                    id_agendamento: 42,
                    periodo: '2026.2',
                    chave: 'sessao_monitor:agendamento:42'
                },
                'tx'
            ],
            [
                {
                    id_usuario: 4,
                    tipo: 'presenca_aluno',
                    pontos: 2,
                    id_disciplina: 3,
                    id_agendamento: 42,
                    periodo: '2026.2',
                    chave: 'presenca_aluno:agendamento:42'
                },
                'tx'
            ]
        ]);
    });
});

describe('Extrato', () => {
    it('saldo, eventos com texto e a posição da própria pessoa na disciplina principal', async () => {
        repo.buscarSaldo.mockResolvedValue({ pontos: 6, tipo_usuario: 'aluno' });
        repo.buscarEventos.mockResolvedValue([
            {
                tipo: 'presenca_aluno',
                pontos: 2,
                criado_em: AGORA,
                disciplina: { nome: 'Cálculo I' }
            },
            { tipo: 'saldo_inicial', pontos: 4, criado_em: AGORA, disciplina: null }
        ]);
        repo.buscarDisciplinaPrincipal.mockResolvedValue(3);
        repo.somarPorUsuario.mockResolvedValue([
            { id_usuario: 9, pontos: 8 },
            { id_usuario: 7, pontos: 4 },
            { id_usuario: 4, pontos: 4 },
            { id_usuario: 5, pontos: 2 }
        ]);
        repo.buscarNomeDisciplina.mockResolvedValue('Cálculo I');

        const r = await pontuacaoService.extrato(4, AGORA);

        expect(r.saldo).toBe(6);
        expect(r.periodo).toBe('2026.2');
        // Empate com o 7: os dois ficam em 2º
        expect(r.posicao).toEqual({ disciplina: 'Cálculo I', lugar: 2, total: 4 });
        expect(r.eventos.map((e) => e.texto)).toEqual([
            'Presença confirmada',
            'Saldo anterior ao extrato'
        ]);
        expect(repo.somarPorUsuario).toHaveBeenCalledWith(3, '2026.2', 'aluno');
    });

    it('sem pontos no semestre: sem posição', async () => {
        repo.buscarSaldo.mockResolvedValue({ pontos: 0, tipo_usuario: 'aluno' });
        repo.buscarEventos.mockResolvedValue([]);
        repo.buscarDisciplinaPrincipal.mockResolvedValue(null);

        const r = await pontuacaoService.extrato(4, AGORA);

        expect(r.posicao).toBeNull();
        expect(repo.somarPorUsuario).not.toHaveBeenCalled();
    });

    it('GET /pontos/extrato exige sessão e usa só o id da sessão', async () => {
        expect((await request(app).get('/pontos/extrato')).status).toBe(401);

        repo.buscarSaldo.mockResolvedValue({ pontos: 0, tipo_usuario: 'aluno' });
        repo.buscarEventos.mockResolvedValue([]);
        repo.buscarDisciplinaPrincipal.mockResolvedValue(null);
        const resposta = await request(app)
            .get('/pontos/extrato?id_usuario=99')
            .set('Cookie', `monipro_sessao=${gerarToken({ id: 4, tipo: 'aluno' })}`);

        expect(resposta.status).toBe(200);
        expect(repo.buscarSaldo).toHaveBeenCalledWith(4);
        expect(resposta.headers['cache-control']).toBe('no-store');
    });
});

describe('Ranking de monitores', () => {
    it('top 10 do semestre com sessões, horas e "você", sem ids', async () => {
        repo.somarPorUsuario.mockResolvedValue([
            { id_usuario: 1, pontos: 30 },
            { id_usuario: 2, pontos: 30 },
            { id_usuario: 3, pontos: 10 }
        ]);
        repo.buscarNomes.mockResolvedValue([
            { id: 1, nome_completo: 'Ana Ribeiro' },
            { id: 2, nome_completo: 'Bruna Lopes' },
            { id: 3, nome_completo: 'Carlos Mendes' }
        ]);
        repo.buscarSessoes.mockResolvedValue([
            {
                id_monitor: 1,
                horario: new Date('2026-11-02T18:00Z'),
                data_fim: new Date('2026-11-02T19:30Z')
            },
            {
                id_monitor: 1,
                horario: new Date('2026-11-05T18:00Z'),
                data_fim: new Date('2026-11-05T19:00Z')
            }
        ]);

        const r = await pontuacaoService.ranking(3, 2, AGORA);

        expect(repo.somarPorUsuario).toHaveBeenCalledWith(3, '2026.2', 'monitor');
        expect(r).toEqual({
            periodo: '2026.2',
            ranking: [
                {
                    posicao: 1,
                    nome: 'Ana Ribeiro',
                    pontos: 30,
                    sessoes: 2,
                    minutos: 150,
                    voce: false
                },
                { posicao: 1, nome: 'Bruna Lopes', pontos: 30, sessoes: 0, minutos: 0, voce: true },
                {
                    posicao: 3,
                    nome: 'Carlos Mendes',
                    pontos: 10,
                    sessoes: 0,
                    minutos: 0,
                    voce: false
                }
            ]
        });
        expect(JSON.stringify(r)).not.toMatch(/id_usuario|email|matricula/);
    });

    it('ninguém pontuou na disciplina: lista vazia', async () => {
        repo.somarPorUsuario.mockResolvedValue([]);

        expect(await pontuacaoService.ranking(3, 2, AGORA)).toEqual({
            periodo: '2026.2',
            ranking: []
        });
        expect(repo.buscarNomes).not.toHaveBeenCalled();
    });
});
