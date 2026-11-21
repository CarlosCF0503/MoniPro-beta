// Plano 7, PR 4: a coordenação é a instância de recurso das faltas (decisão de 21/11). O banco
// real fica com tests/integracao/coordenacaoFaltas.int.test.js.
jest.mock('../src/repositories/painelRepository');
jest.mock('../src/repositories/agendamentoRepository');

const request = require('supertest');
const repo = require('../src/repositories/painelRepository');
const agRepo = require('../src/repositories/agendamentoRepository');
const painelService = require('../src/services/painelService');
const { gerarToken } = require('./helpers/token');
const app = require('../src/app');

const H = 3600e3;
const D = 24 * H;
const AGORA = new Date('2026-11-21T15:00:00.000Z');
const COORD = { id: 50, nome: 'Profa. Helena' };
const inscricao = (extra = {}) => ({
    id: 9,
    id_aluno: 4,
    status: 'pendente',
    ausente_em: null,
    horario: new Date(AGORA.getTime() - 20 * D),
    status_vaga: 'realizada',
    id_monitor: 1,
    ...extra
});
const linha = (extra = {}) => ({
    id: 9,
    ausente_em: null,
    presenca_aluno_em: null,
    aluno: { nome_completo: 'Diego Martins' },
    monitoria: {
        horario: new Date('2026-11-10T17:00:00.000Z'),
        monitor: { nome_completo: 'Ana Ribeiro' },
        disciplina: { nome: 'Cálculo I' }
    },
    ...extra
});

beforeEach(() => {
    jest.clearAllMocks();
    repo.emTransacao.mockImplementation((fn) => fn('tx'));
    repo.registrar.mockImplementation(async (dados) => ({ ...dados, criado_em: AGORA }));
});

describe('Listas de faltas', () => {
    it('faltas, sem presença e bloqueados agora, com nomes', async () => {
        repo.listarInscricoesParaFaltas.mockResolvedValue({
            faltas: [linha({ ausente_em: new Date('2026-11-10T20:00:00.000Z') })],
            semPresenca: [linha({ id: 10, presenca_aluno_em: new Date() })]
        });
        // Aluno 4: 3 faltas em 3 dias (bloqueado); aluno 5: uma só
        repo.buscarAusencias.mockResolvedValue([
            { id_aluno: 4, ausente_em: new Date(AGORA.getTime() - 3 * D) },
            { id_aluno: 4, ausente_em: new Date(AGORA.getTime() - 2 * D) },
            { id_aluno: 4, ausente_em: new Date(AGORA.getTime() - 1 * D) },
            { id_aluno: 5, ausente_em: new Date(AGORA.getTime() - 1 * D) }
        ]);
        repo.nomesDeUsuarios.mockResolvedValue(new Map([[4, 'Diego Martins']]));

        const r = await painelService.faltas('2026.2', AGORA);

        expect(r.faltas[0]).toEqual({
            id: 9,
            aluno: 'Diego Martins',
            monitor: 'Ana Ribeiro',
            disciplina: 'Cálculo I',
            horario: new Date('2026-11-10T17:00:00.000Z'),
            ausente_em: new Date('2026-11-10T20:00:00.000Z'),
            aluno_confirmou: false
        });
        expect(r.sem_presenca[0]).toMatchObject({ id: 10, aluno_confirmou: true });
        expect(r.bloqueados).toEqual([
            { aluno: 'Diego Martins', ate: new Date(AGORA.getTime() + 6 * D), faltas: 3 }
        ]);
        expect(repo.nomesDeUsuarios).toHaveBeenCalledWith([4]);
    });

    it('semestre que não começou: listas vazias sem consultar; conta excluída aparece sem nome', async () => {
        repo.buscarAusencias.mockResolvedValue([
            { id_aluno: 7, ausente_em: new Date(AGORA.getTime() - 3 * D) },
            { id_aluno: 7, ausente_em: new Date(AGORA.getTime() - 2 * D) },
            { id_aluno: 7, ausente_em: new Date(AGORA.getTime() - 1 * D) }
        ]);
        repo.nomesDeUsuarios.mockResolvedValue(new Map());
        const r = await painelService.faltas('2027.2', AGORA);
        expect(repo.listarInscricoesParaFaltas).not.toHaveBeenCalled();
        expect(r).toMatchObject({ faltas: [], sem_presenca: [] });
        expect(r.bloqueados[0].aluno).toBeNull();
    });
});

describe('Marcar falta pela coordenação', () => {
    it('vale depois dos 7 dias do monitor e entra na auditoria', async () => {
        agRepo.bloquearParaPresenca.mockResolvedValue(inscricao());
        const r = await painelService.marcarFalta(9, COORD, AGORA);
        expect(agRepo.marcarAusencia).toHaveBeenCalledWith(9, AGORA, 'tx');
        expect(repo.registrar.mock.calls[0][0]).toMatchObject({
            id_usuario: 50,
            acao: 'marcar_falta',
            alvo: 'agendamento:9'
        });
        expect(repo.registrar.mock.calls[0][0].descricao).toMatch(
            /^Marcou falta na inscrição 9 \(sessão de \d\d\/\d\d\)$/
        );
        expect(r).toMatchObject({ ausente_em: AGORA, id_aluno: 4 });
    });

    it.each([
        [null, 404],
        [inscricao({ status: 'concluido' }), 409],
        [inscricao({ ausente_em: new Date() }), 409],
        [inscricao({ status: 'cancelado' }), 422],
        [inscricao({ status: 'em_espera' }), 422],
        [inscricao({ status_vaga: 'cancelada' }), 422],
        [inscricao({ horario: new Date(AGORA.getTime() + H) }), 422]
    ])('não marca: %o → %i', async (ag, status) => {
        agRepo.bloquearParaPresenca.mockResolvedValue(ag);
        await expect(painelService.marcarFalta(9, COORD, AGORA)).rejects.toMatchObject({
            statusCode: status
        });
        expect(agRepo.marcarAusencia).not.toHaveBeenCalled();
        expect(repo.registrar).not.toHaveBeenCalled();
    });
});

describe('Anular falta', () => {
    it('exige justificativa de 10 a 300 caracteres', async () => {
        for (const motivo of [undefined, 'curta', 'x'.repeat(301)]) {
            await expect(painelService.anularFalta(9, motivo, COORD)).rejects.toMatchObject({
                statusCode: 400
            });
        }
        expect(agRepo.bloquearParaPresenca).not.toHaveBeenCalled();
    });

    it('anula, sem virar presença, e registra a justificativa', async () => {
        agRepo.bloquearParaPresenca.mockResolvedValue(inscricao({ ausente_em: new Date() }));
        repo.anularFalta.mockResolvedValue(1);
        const r = await painelService.anularFalta(9, '  Atestado médico entregue. ', COORD);
        expect(repo.anularFalta).toHaveBeenCalledWith(9, 'tx');
        expect(agRepo.registrarPresenca).not.toHaveBeenCalled();
        expect(repo.registrar.mock.calls[0][0]).toMatchObject({
            acao: 'anular_falta',
            alvo: 'agendamento:9'
        });
        expect(repo.registrar.mock.calls[0][0].descricao).toMatch(/: Atestado médico entregue\.$/);
        expect(r.registro.usuario).toBe('Profa. Helena');
    });

    it('sem falta, inexistente ou anulada ao mesmo tempo: nada registrado', async () => {
        agRepo.bloquearParaPresenca.mockResolvedValue(null);
        await expect(painelService.anularFalta(9, 'Atestado médico.', COORD)).rejects.toMatchObject(
            { statusCode: 404 }
        );
        agRepo.bloquearParaPresenca.mockResolvedValue(inscricao());
        await expect(painelService.anularFalta(9, 'Atestado médico.', COORD)).rejects.toMatchObject(
            { statusCode: 409 }
        );
        agRepo.bloquearParaPresenca.mockResolvedValue(inscricao({ ausente_em: new Date() }));
        repo.anularFalta.mockResolvedValue(0);
        await expect(painelService.anularFalta(9, 'Atestado médico.', COORD)).rejects.toMatchObject(
            { statusCode: 409 }
        );
        expect(repo.registrar).not.toHaveBeenCalled();
    });

    it('descrição longa fica em 300 caracteres', async () => {
        agRepo.bloquearParaPresenca.mockResolvedValue(inscricao({ ausente_em: new Date() }));
        repo.anularFalta.mockResolvedValue(1);
        await painelService.anularFalta(9, 'j'.repeat(300), COORD);
        expect(repo.registrar.mock.calls[0][0].descricao).toHaveLength(300);
    });
});

describe('Rotas de faltas', () => {
    const coord = gerarToken({ id: 50, nome_completo: 'Profa. Helena', tipo: 'coordenador' });
    const com = (req, token) => req.set('Cookie', `monipro_sessao=${token}`);

    it('aluno e monitor recebem 403', async () => {
        for (const tipo of ['aluno', 'monitor']) {
            const t = gerarToken({ id: 1, tipo });
            expect((await com(request(app).get('/admin/faltas'), t)).status).toBe(403);
            expect((await com(request(app).post('/admin/agendamentos/9/falta'), t)).status).toBe(
                403
            );
            expect(
                (await com(request(app).post('/admin/agendamentos/9/anular-falta'), t)).status
            ).toBe(403);
        }
    });

    it('lista, marca e anula pela coordenação; id inválido 400', async () => {
        repo.listarInscricoesParaFaltas.mockResolvedValue({ faltas: [], semPresenca: [] });
        repo.buscarAusencias.mockResolvedValue([]);
        repo.nomesDeUsuarios.mockResolvedValue(new Map());
        const l = await com(request(app).get('/admin/faltas?periodo=2026.2'), coord);
        expect(l.body).toMatchObject({
            success: true,
            faltas: [],
            sem_presenca: [],
            bloqueados: []
        });

        agRepo.bloquearParaPresenca.mockResolvedValue(inscricao());
        expect((await com(request(app).post('/admin/agendamentos/9/falta'), coord)).status).toBe(
            200
        );

        agRepo.bloquearParaPresenca.mockResolvedValue(inscricao({ ausente_em: new Date() }));
        repo.anularFalta.mockResolvedValue(1);
        const a = await com(request(app).post('/admin/agendamentos/9/anular-falta'), coord).send({
            motivo: 'Atestado médico entregue.'
        });
        expect(a.status).toBe(200);
        const ruim = await com(request(app).post('/admin/agendamentos/abc/falta'), coord);
        expect(ruim.status).toBe(400);
        expect(ruim.body.erro).toBe('Inscrição inválida.');
    });
});
