// Certificados (RF-005), PR 4: verificação pública da declaração pelo código.
// Limite baixo neste arquivo para testar o 429 sem fazer 21 pedidos.
process.env.LIMITE_VERIFICACOES_MINUTO = '3';
jest.mock('../src/repositories/certificadoRepository');

const request = require('supertest');
const repo = require('../src/repositories/certificadoRepository');
const app = require('../src/app');

const CODIGO = 'K7Q2M9XR4TWB8HNP3CVZ6DFJ5G'; // pragma: allowlist secret
const declaracao = (extra = {}) => ({
    id: 1,
    codigo: CODIGO,
    id_usuario: 10,
    periodo: '2026.2',
    carga_minutos: 270,
    situacao: 'valido',
    emitido_em: new Date('2026-11-17T15:00:00.000Z'),
    revogado_em: null,
    snapshot: {
        nome: 'Ana Ribeiro',
        email: 'nao-deveria@exemplo.edu.br',
        sessoes: [{ data: '2026-11-02T18:00:00.000Z', disciplina: 'Cálculo I', minutos: 90 }]
    },
    ...extra
});

// Cada teste usa um IP diferente, para o limite de um não atrapalhar o outro
let ip = 0;
const verificar = (codigo = CODIGO, de = `10.1.0.${++ip}`) =>
    request(app)
        .get('/certificados/verificar/' + codigo)
        .set('X-Forwarded-For', de);

beforeEach(() => jest.clearAllMocks());

describe('GET /certificados/verificar/:codigo', () => {
    it('sem login: devolve só nome, semestre, horas, emissão e situação', async () => {
        repo.buscarPorCodigo.mockResolvedValue(declaracao());

        const r = await verificar();

        expect(r.status).toBe(200);
        expect(r.body.declaracao).toEqual({
            nome: 'Ana Ribeiro',
            periodo: '2026.2',
            carga_minutos: 270,
            emitido_em: '2026-11-17T15:00:00.000Z',
            situacao: 'valido'
        });
        expect(JSON.stringify(r.body)).not.toMatch(
            /email|matricula|sessoes|id_usuario|exemplo\.edu/
        );
        expect(r.headers['cache-control']).toBe('no-store');
    });

    it('aceita o código com hífens e minúsculas', async () => {
        repo.buscarPorCodigo.mockResolvedValue(declaracao());
        const comHifens = CODIGO.toLowerCase()
            .match(/.{1,4}/g)
            .join('-');

        expect((await verificar(comHifens)).status).toBe(200);
        expect(repo.buscarPorCodigo).toHaveBeenCalledWith(CODIGO);
    });

    it('revogada mostra a data da revogação; substituída aparece como tal', async () => {
        repo.buscarPorCodigo.mockResolvedValue(
            declaracao({ situacao: 'revogado', revogado_em: new Date('2026-11-20T12:00:00.000Z') })
        );
        expect((await verificar()).body.declaracao).toMatchObject({
            situacao: 'revogado',
            revogado_em: '2026-11-20T12:00:00.000Z'
        });

        repo.buscarPorCodigo.mockResolvedValue(declaracao({ situacao: 'substituido' }));
        const r = await verificar();
        expect(r.body.declaracao.situacao).toBe('substituido');
        expect(r.body.declaracao).not.toHaveProperty('revogado_em');
    });

    it('código inexistente: 404; mal formado: 404 sem ir ao banco', async () => {
        repo.buscarPorCodigo.mockResolvedValue(null);
        expect((await verificar()).status).toBe(404);

        repo.buscarPorCodigo.mockClear();
        expect((await verificar('abc')).status).toBe(404);
        expect((await verificar('0' + CODIGO.slice(1))).status).toBe(404);
        expect(repo.buscarPorCodigo).not.toHaveBeenCalled();
    });

    it('limite por IP: a partir do limite configurado, 429', async () => {
        repo.buscarPorCodigo.mockResolvedValue(declaracao());
        const mesmoIp = '10.9.9.9';

        for (let i = 0; i < 3; i++) expect((await verificar(CODIGO, mesmoIp)).status).toBe(200);
        expect((await verificar(CODIGO, mesmoIp)).status).toBe(429);
        // Outro IP continua consultando
        expect((await verificar(CODIGO, '10.9.9.10')).status).toBe(200);
    });
});
