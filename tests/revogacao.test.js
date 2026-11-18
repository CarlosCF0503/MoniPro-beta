// Certificados (RF-005), PR 5: revogação pelo script scripts/certificados.js.
jest.mock('../src/repositories/certificadoRepository');
jest.mock('../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const repo = require('../src/repositories/certificadoRepository');
const logger = require('../src/utils/logger');
const certificadoService = require('../src/services/certificadoService');
const { lerArgumentos } = require('../scripts/certificados');

const CODIGO = 'K7Q2M9XR4TWB8HNP3CVZ6DFJ5G'; // pragma: allowlist secret
const declaracao = (extra = {}) => ({
    id: 7,
    codigo: CODIGO,
    id_usuario: 10,
    periodo: '2026.2',
    carga_minutos: 270,
    situacao: 'valido',
    emitido_em: new Date('2026-11-17T15:00:00.000Z'),
    revogado_em: null,
    snapshot: { nome: 'Ana Ribeiro' },
    ...extra
});
const MOTIVO = 'Sessões lançadas por engano';

beforeEach(() => jest.clearAllMocks());

describe('certificadoService.revogar', () => {
    it('sem aplicar: mostra a declaração e não grava nada', async () => {
        repo.buscarPorCodigo.mockResolvedValue(declaracao());

        const r = await certificadoService.revogar(CODIGO, MOTIVO);

        expect(r).toMatchObject({
            aplicado: false,
            motivo: MOTIVO,
            declaracao: { nome: 'Ana Ribeiro', situacao: 'valido', carga_minutos: 270 }
        });
        expect(repo.revogar).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
    });

    it('aplicando: grava pelo id, com o motivo sem espaços, e deixa uma linha no log sem o código', async () => {
        repo.buscarPorCodigo.mockResolvedValue(declaracao());
        repo.revogar.mockResolvedValue(1);
        const agora = new Date('2026-11-20T12:00:00.000Z');
        const impresso = CODIGO.match(/.{1,4}/g)
            .join('-')
            .toLowerCase();

        const r = await certificadoService.revogar(impresso, '  ' + MOTIVO + '  ', {
            aplicar: true,
            agora
        });

        expect(repo.buscarPorCodigo).toHaveBeenCalledWith(CODIGO);
        expect(repo.revogar).toHaveBeenCalledWith(7, MOTIVO, agora);
        expect(r.declaracao).toMatchObject({ situacao: 'revogado', revogado_em: agora });
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                id_certificado: 7,
                motivo: MOTIVO,
                situacao_anterior: 'valido'
            }),
            'Declaração de horas revogada'
        );
        expect(JSON.stringify(logger.info.mock.calls)).not.toContain(CODIGO);
    });

    it('recusa código mal formado e motivo curto ou longo demais antes de ir ao banco', async () => {
        await expect(certificadoService.revogar('abc', MOTIVO)).rejects.toMatchObject({
            statusCode: 400
        });
        await expect(certificadoService.revogar(CODIGO, ' oi ')).rejects.toMatchObject({
            statusCode: 400
        });
        await expect(certificadoService.revogar(CODIGO, 'x'.repeat(501))).rejects.toMatchObject({
            statusCode: 400
        });
        expect(repo.buscarPorCodigo).not.toHaveBeenCalled();
    });

    it('código inexistente: 404; já revogada: 409 com a data', async () => {
        repo.buscarPorCodigo.mockResolvedValue(null);
        await expect(certificadoService.revogar(CODIGO, MOTIVO)).rejects.toMatchObject({
            statusCode: 404
        });

        repo.buscarPorCodigo.mockResolvedValue(
            declaracao({ situacao: 'revogado', revogado_em: new Date('2026-11-18T10:00:00.000Z') })
        );
        await expect(certificadoService.revogar(CODIGO, MOTIVO, { aplicar: true })).rejects.toThrow(
            /já foi revogada em 2026-11-18/
        );
        expect(repo.revogar).not.toHaveBeenCalled();
    });

    it('se outra revogação gravou antes (0 linhas alteradas): 409 e sem log', async () => {
        repo.buscarPorCodigo.mockResolvedValue(declaracao());
        repo.revogar.mockResolvedValue(0);

        await expect(
            certificadoService.revogar(CODIGO, MOTIVO, { aplicar: true })
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(logger.info).not.toHaveBeenCalled();
    });
});

describe('scripts/certificados.js: argumentos', () => {
    it('lê o código, o motivo e o --aplicar em qualquer ordem', () => {
        expect(lerArgumentos(['--motivo', MOTIVO, '--revogar', CODIGO])).toEqual({
            codigo: CODIGO,
            motivo: MOTIVO,
            aplicar: false
        });
        expect(lerArgumentos(['--aplicar', '--revogar', CODIGO, '--motivo', MOTIVO])).toEqual({
            codigo: CODIGO,
            motivo: MOTIVO,
            aplicar: true
        });
    });

    it('sem código ou sem motivo: null (o script mostra o uso)', () => {
        expect(lerArgumentos(['--revogar', CODIGO])).toBeNull();
        expect(lerArgumentos(['--revogar', '--motivo', MOTIVO])).toBeNull();
        expect(lerArgumentos([])).toBeNull();
    });
});
