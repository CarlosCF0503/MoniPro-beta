// Plano 6 (RF-006/007, RN-013): avaliação da monitoria. O banco real fica com
// tests/integracao/avaliacao.int.test.js.
jest.mock('../src/repositories/avaliacaoRepository');
jest.mock('../src/repositories/agendamentoRepository');
jest.mock('../src/repositories/painelRepository');

const request = require('supertest');
const repo = require('../src/repositories/avaliacaoRepository');
const agRepo = require('../src/repositories/agendamentoRepository');
const painelRepo = require('../src/repositories/painelRepository');
const avaliacaoService = require('../src/services/avaliacaoService');
const { resumirAvaliacoes, media, mesDoCampus } = require('../src/utils/avaliacao');
const { gerarToken } = require('./helpers/token');
const app = require('../src/app');

const D = 24 * 3600e3;
const AGORA = new Date('2026-11-21T15:00:00.000Z');
const COORD = { id: 50, nome: 'Profa. Helena' };
const insc = (extra = {}) => ({
    id: 9,
    id_aluno: 4,
    id_monitor: 1,
    status: 'concluido',
    horario: new Date(AGORA - 2 * D),
    ...extra
});

beforeEach(() => {
    jest.clearAllMocks();
    repo.emTransacao.mockImplementation((fn) => fn('tx'));
    painelRepo.registrar.mockImplementation(async (d) => ({ ...d, criado_em: AGORA }));
});

describe('Resumo do monitor', () => {
    it('média com uma casa só a partir de 3; abaixo, null', () => {
        expect(media([5, 4])).toBeNull();
        expect(media([5, 4, 4])).toBe(4.3);
        expect(media([5, 5, 4, 4, 4, 3])).toBe(4.2);
    });

    it('mês no fuso do campus', () => {
        // 1/12 às 01:00 UTC ainda é 30/11 em Brasília
        expect(mesDoCampus(new Date('2026-12-01T01:00:00.000Z'))).toBe('2026-11');
    });

    it('distribuição, só comentários preenchidos, no máximo 10, sem id nem data exata', () => {
        const lista = Array.from({ length: 12 }, (_, i) => ({
            nota: (i % 5) + 1,
            comentario: i === 3 ? null : `comentário ${i}`,
            criado_em: new Date('2026-11-10T12:00:00.000Z')
        }));
        const r = resumirAvaliacoes(lista);
        expect(r).toMatchObject({
            total: 12,
            minimo: 3,
            distribuicao: { 1: 3, 2: 3, 3: 2, 4: 2, 5: 2 }
        });
        expect(r.comentarios).toHaveLength(10);
        expect(r.comentarios[0]).toEqual({ nota: 1, comentario: 'comentário 0', mes: '2026-11' });
        expect(r.comentarios.map((c) => c.comentario)).not.toContain(null);
    });

    it('sem avaliações', () => {
        expect(resumirAvaliacoes([])).toEqual({
            total: 0,
            media: null,
            minimo: 3,
            distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            comentarios: []
        });
    });

    it('o serviço usa só as visíveis do próprio monitor', async () => {
        repo.visiveisDoMonitor.mockResolvedValue([{ nota: 5, comentario: null, criado_em: AGORA }]);
        const r = await avaliacaoService.resumoDoMonitor(1);
        expect(repo.visiveisDoMonitor).toHaveBeenCalledWith(1);
        expect(r.total).toBe(1);
    });
});

describe('Aluno avalia', () => {
    it('grava nota e comentário limpo; comentário vazio vira null', async () => {
        agRepo.bloquearParaPresenca.mockResolvedValue(insc());
        repo.existeParaInscricao.mockResolvedValue(false);
        repo.criar.mockResolvedValue({ nota: 4, criado_em: AGORA });
        await avaliacaoService.avaliar(9, 4, { nota: 4, comentario: '  Boa monitoria.  ' }, AGORA);
        expect(repo.criar).toHaveBeenCalledWith(
            {
                id_agendamento: 9,
                id_aluno: 4,
                id_monitor: 1,
                nota: 4,
                comentario: 'Boa monitoria.'
            },
            'tx'
        );
        await avaliacaoService.avaliar(9, 4, { nota: 5, comentario: '   ' }, AGORA);
        expect(repo.criar.mock.calls[1][0].comentario).toBeNull();
    });

    it.each([
        [{}, /nota de 1 a 5/],
        [{ nota: 0 }, /nota de 1 a 5/],
        [{ nota: 6 }, /nota de 1 a 5/],
        [{ nota: 4.5 }, /nota de 1 a 5/],
        [{ nota: '5' }, /nota de 1 a 5/],
        [{ nota: 3, comentario: 7 }, /texto/],
        [{ nota: 3, comentario: 'x'.repeat(301) }, /300/]
    ])('validação %#', async (corpo, mensagem) => {
        await expect(avaliacaoService.avaliar(9, 4, corpo, AGORA)).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringMatching(mensagem)
        });
        expect(repo.emTransacao).not.toHaveBeenCalled();
    });

    it.each([
        [null, 404],
        [insc({ id_aluno: 99 }), 404],
        [insc({ status: 'pendente' }), 422],
        [insc({ horario: new Date(AGORA - 8 * D) }), 422]
    ])('não aceita %#', async (ag, status) => {
        agRepo.bloquearParaPresenca.mockResolvedValue(ag);
        await expect(avaliacaoService.avaliar(9, 4, { nota: 5 }, AGORA)).rejects.toMatchObject({
            statusCode: status
        });
        expect(repo.criar).not.toHaveBeenCalled();
    });

    it('segunda avaliação: 409', async () => {
        agRepo.bloquearParaPresenca.mockResolvedValue(insc());
        repo.existeParaInscricao.mockResolvedValue(true);
        await expect(avaliacaoService.avaliar(9, 4, { nota: 5 }, AGORA)).rejects.toMatchObject({
            statusCode: 409
        });
    });
});

describe('Moderação', () => {
    it('lista para a coordenação sem dado do aluno', async () => {
        repo.comComentarioNoPeriodo.mockResolvedValue([
            {
                id: 7,
                nota: 1,
                comentario: 'Ruim',
                criado_em: AGORA,
                oculto_em: null,
                agendamento: {
                    monitoria: {
                        monitor: { nome_completo: 'Ana' },
                        disciplina: { nome: 'Cálculo I' }
                    }
                }
            }
        ]);
        expect(await avaliacaoService.paraModeracao(AGORA, AGORA)).toEqual([
            {
                id: 7,
                monitor: 'Ana',
                disciplina: 'Cálculo I',
                nota: 1,
                comentario: 'Ruim',
                criado_em: AGORA,
                oculto_em: null
            }
        ]);
    });

    it('ocultar exige motivo e registra; mostrar de novo também registra', async () => {
        await expect(avaliacaoService.ocultar(7, 'curto', COORD, AGORA)).rejects.toMatchObject({
            statusCode: 400
        });
        repo.buscar.mockResolvedValue({ id: 7, oculto_em: null });
        repo.moderar.mockResolvedValue(1);
        const r = await avaliacaoService.ocultar(7, 'Comentário ofensivo.', COORD, AGORA);
        expect(repo.moderar).toHaveBeenCalledWith(
            7,
            { ocultar: true, idModerador: 50, quando: AGORA },
            'tx'
        );
        expect(painelRepo.registrar.mock.calls[0][0]).toMatchObject({
            acao: 'ocultar_avaliacao',
            alvo: 'avaliacao:7',
            descricao: 'Ocultou o comentário da avaliação 7: Comentário ofensivo.'
        });
        expect(r.registro.usuario).toBe('Profa. Helena');

        repo.buscar.mockResolvedValue({ id: 7, oculto_em: AGORA });
        await avaliacaoService.reexibir(7, COORD, AGORA);
        expect(painelRepo.registrar.mock.calls[1][0].acao).toBe('reexibir_avaliacao');
    });

    it('inexistente 404; estado errado ou mudado ao mesmo tempo 409', async () => {
        repo.buscar.mockResolvedValue(null);
        await expect(avaliacaoService.reexibir(7, COORD)).rejects.toMatchObject({
            statusCode: 404
        });
        repo.buscar.mockResolvedValue({ id: 7, oculto_em: AGORA });
        await expect(
            avaliacaoService.ocultar(7, 'Motivo suficiente.', COORD)
        ).rejects.toMatchObject({ statusCode: 409 });
        repo.buscar.mockResolvedValue({ id: 7, oculto_em: null });
        await expect(avaliacaoService.reexibir(7, COORD)).rejects.toMatchObject({
            statusCode: 409
        });
        repo.moderar.mockResolvedValue(0);
        await expect(
            avaliacaoService.ocultar(7, 'Motivo suficiente.', COORD)
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(painelRepo.registrar).not.toHaveBeenCalled();
    });
});

describe('Rotas', () => {
    const com = (req, token) => req.set('Cookie', `monipro_sessao=${token}`);
    const aluno = gerarToken({ id: 4, tipo: 'aluno' });
    const monitor = gerarToken({ id: 1, tipo: 'monitor' });
    const coord = gerarToken({ id: 50, nome_completo: 'Profa. Helena', tipo: 'coordenador' });

    it('só o aluno avalia', async () => {
        expect(
            (await com(request(app).post('/agendamentos/9/avaliacao'), monitor).send({ nota: 5 }))
                .status
        ).toBe(403);
        agRepo.bloquearParaPresenca.mockResolvedValue(insc({ horario: new Date(Date.now() - D) }));
        repo.existeParaInscricao.mockResolvedValue(false);
        repo.criar.mockResolvedValue({ nota: 5, criado_em: new Date() });
        const r = await com(request(app).post('/agendamentos/9/avaliacao'), aluno).send({
            nota: 5
        });
        expect(r.status).toBe(201);
        expect(
            (await com(request(app).post('/agendamentos/x/avaliacao'), aluno).send({ nota: 5 }))
                .status
        ).toBe(404);
    });

    it('resumo só para o monitor, sem cache', async () => {
        expect((await com(request(app).get('/perfil/avaliacoes/resumo'), aluno)).status).toBe(403);
        repo.visiveisDoMonitor.mockResolvedValue([]);
        const r = await com(request(app).get('/perfil/avaliacoes/resumo'), monitor);
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ success: true, total: 0, media: null });
        expect(r.headers['cache-control']).toBe('no-store');
    });

    it('moderação só para a coordenação', async () => {
        expect((await com(request(app).get('/admin/avaliacoes'), monitor)).status).toBe(403);
        repo.comComentarioNoPeriodo.mockResolvedValue([]);
        const l = await com(request(app).get('/admin/avaliacoes?periodo=2026.2'), coord);
        expect(l.body).toEqual({ success: true, periodo: '2026.2', avaliacoes: [] });
        expect((await com(request(app).get('/admin/avaliacoes'), coord)).status).toBe(200);
        repo.buscar.mockResolvedValue({ id: 7, oculto_em: null });
        repo.moderar.mockResolvedValue(1);
        const o = await com(request(app).post('/admin/avaliacoes/7/ocultar'), coord).send({
            motivo: 'Comentário ofensivo.'
        });
        expect(o.status).toBe(200);
        repo.buscar.mockResolvedValue({ id: 7, oculto_em: new Date() });
        expect((await com(request(app).post('/admin/avaliacoes/7/reexibir'), coord)).status).toBe(
            200
        );
        const ruim = await com(request(app).post('/admin/avaliacoes/x/ocultar'), coord);
        expect(ruim.body.erro).toBe('Avaliação inválida.');
    });
});
