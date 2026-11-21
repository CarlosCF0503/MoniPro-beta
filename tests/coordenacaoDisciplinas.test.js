// Plano 7, PR 3: disciplinas criadas por monitores ficam pendentes até a coordenação aprovar ou
// mesclar. O banco real fica com tests/integracao/coordenacaoDisciplinas.int.test.js.
jest.mock('../src/repositories/painelRepository');

const request = require('supertest');
const repo = require('../src/repositories/painelRepository');
const painelService = require('../src/services/painelService');
const { podeVer } = require('../src/services/disciplinaService');
const { filtroVisivel } = require('../src/repositories/disciplinaRepository');
const { normalizar, distancia, maisParecida } = require('../src/utils/semelhancaDisciplina');
const { enviados } = require('../src/services/email');
const { montar } = require('../src/services/email/modelos');
const { gerarToken } = require('./helpers/token');
const app = require('../src/app');

const COORD = { id: 50, nome: 'Profa. Helena' };
const APROVADAS = [
    { id: 2, nome: 'Algoritmos' },
    { id: 3, nome: 'Cálculo I' },
    { id: 4, nome: 'Banco de Dados' },
    { id: 5, nome: 'Estruturas de Dados' }
];
const pendente = (extra = {}) => ({
    id: 31,
    nome: 'Calculo 1',
    status: 'pendente',
    id_criador: 7,
    ...extra
});
const esperarEmails = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
    jest.clearAllMocks();
    enviados.length = 0;
    repo.emTransacao.mockImplementation((fn) => fn('tx'));
    repo.registrar.mockImplementation(async (dados) => ({ ...dados, criado_em: new Date() }));
    repo.contatoDoUsuario.mockResolvedValue({
        nome: 'Carlos Mendes',
        email: 'carlos@exemplo.invalid'
    });
});

describe('Nome parecido', () => {
    it.each([
        ['Cálculo I', 'calculo 1'],
        ['Estrutura de dados', 'estrutura dado'],
        ['  Banco   de Dados II ', 'banco dado 2']
    ])('normaliza "%s" para "%s"', (nome, esperado) => expect(normalizar(nome)).toBe(esperado));

    it('distância de edição', () => {
        expect(distancia('calculo', 'calculo')).toBe(0);
        expect(distancia('calculo', 'calcolo')).toBe(1);
        expect(distancia('', 'abc')).toBe(3);
    });

    it.each([
        ['Calculo 1', 'Cálculo I'],
        ['Estrutura de dados', 'Estruturas de Dados'],
        ['Algoritimos', 'Algoritmos'],
        ['Banco de dados', 'Banco de Dados']
    ])('"%s" lembra "%s"', (nome, esperado) =>
        expect(maisParecida(nome, APROVADAS).nome).toBe(esperado)
    );

    it.each(['Programação Orientada a Objetos', 'Física I', 'Cálculo II'])(
        '"%s" não lembra nenhuma',
        (nome) => expect(maisParecida(nome, APROVADAS)).toBeNull()
    );
});

describe('Quem vê a disciplina pendente', () => {
    const aluno = { id: 1, tipo: 'aluno' };
    const criador = { id: 7, tipo: 'monitor' };
    const outroMonitor = { id: 8, tipo: 'monitor' };
    const coord = { id: 50, tipo: 'coordenador' };

    it('aprovada: todo mundo; pendente: só quem criou e a coordenação', () => {
        expect(podeVer({ status: 'aprovada', id_criador: 7 }, aluno)).toBe(true);
        expect(podeVer(pendente(), aluno)).toBe(false);
        expect(podeVer(pendente(), outroMonitor)).toBe(false);
        expect(podeVer(pendente(), criador)).toBe(true);
        expect(podeVer(pendente(), coord)).toBe(true);
        expect(podeVer(null, coord)).toBe(false);
    });

    it('filtro da listagem para cada papel', () => {
        expect(filtroVisivel(aluno)).toEqual({ status: 'aprovada' });
        expect(filtroVisivel(coord)).toEqual({});
        expect(filtroVisivel(criador)).toEqual({
            OR: [{ status: 'aprovada' }, { status: 'pendente', id_criador: 7 }]
        });
    });
});

describe('Lista de revisão', () => {
    it('cada pendente vem com a aprovada mais parecida', async () => {
        repo.listarDisciplinasPendentes.mockResolvedValue([
            {
                id: 31,
                nome: 'Calculo 1',
                criada_em: new Date(),
                criador: 'Carlos',
                vagas: 2,
                id_criador: 7
            },
            {
                id: 32,
                nome: 'Programação Orientada a Objetos',
                criada_em: new Date(),
                criador: null,
                vagas: 0,
                id_criador: null
            }
        ]);
        repo.listarDisciplinasAprovadas.mockResolvedValue(APROVADAS);
        const r = await painelService.disciplinasPendentes();
        expect(r.disciplinas[0].parecida).toEqual({ id: 3, nome: 'Cálculo I' });
        expect(r.disciplinas[1].parecida).toBeNull();
        expect(r.disciplinas[0]).not.toHaveProperty('id_criador');
        expect(r.aprovadas).toHaveLength(4);
    });
});

describe('Aprovar', () => {
    it('publica, registra e avisa quem criou', async () => {
        repo.buscarDisciplina.mockResolvedValue(pendente());
        repo.aprovarDisciplina.mockResolvedValue(1);
        const r = await painelService.aprovarDisciplina(31, COORD);
        expect(repo.aprovarDisciplina).toHaveBeenCalledWith(31, 'tx');
        expect(repo.registrar.mock.calls[0][0]).toMatchObject({
            acao: 'aprovar_disciplina',
            alvo: 'disciplina:31',
            descricao: 'Aprovou a disciplina "Calculo 1"'
        });
        expect(r.registro.usuario).toBe('Profa. Helena');
        await esperarEmails();
        expect(enviados[0]).toMatchObject({
            para: 'carlos@exemplo.invalid',
            modelo: 'disciplina-aprovada'
        });
    });

    it('inexistente 404; já aprovada ou revisada ao mesmo tempo 409', async () => {
        repo.buscarDisciplina.mockResolvedValue(null);
        await expect(painelService.aprovarDisciplina(31, COORD)).rejects.toMatchObject({
            statusCode: 404
        });
        repo.buscarDisciplina.mockResolvedValue(pendente({ status: 'aprovada' }));
        await expect(painelService.aprovarDisciplina(31, COORD)).rejects.toMatchObject({
            statusCode: 409
        });
        repo.buscarDisciplina.mockResolvedValue(pendente());
        repo.aprovarDisciplina.mockResolvedValue(0);
        await expect(painelService.aprovarDisciplina(31, COORD)).rejects.toMatchObject({
            statusCode: 409
        });
        expect(repo.registrar).not.toHaveBeenCalled();
    });

    it('disciplina sem criador conhecido: aprova sem e-mail', async () => {
        repo.buscarDisciplina.mockResolvedValue(pendente({ id_criador: null }));
        repo.aprovarDisciplina.mockResolvedValue(1);
        await painelService.aprovarDisciplina(31, COORD);
        await esperarEmails();
        expect(enviados).toHaveLength(0);
        expect(repo.contatoDoUsuario).not.toHaveBeenCalled();
    });
});

describe('Mesclar', () => {
    it('move vagas e pontos para a aprovada, registra e avisa', async () => {
        repo.buscarDisciplina
            .mockResolvedValueOnce(pendente())
            .mockResolvedValueOnce({ id: 3, nome: 'Cálculo I', status: 'aprovada' });
        repo.mesclarDisciplina.mockResolvedValue({ vagas: 2, pontos: 5 });

        const r = await painelService.mesclarDisciplina(31, 3, COORD);

        expect(repo.mesclarDisciplina).toHaveBeenCalledWith(31, 3, 'tx');
        expect(r).toMatchObject({ vagas: 2, pontos: 5 });
        expect(repo.registrar.mock.calls[0][0]).toMatchObject({
            acao: 'mesclar_disciplina',
            alvo: 'disciplina:3',
            descricao: 'Mesclou "Calculo 1" com "Cálculo I" (2 vagas movidas)'
        });
        await esperarEmails();
        expect(enviados[0]).toMatchObject({ modelo: 'disciplina-mesclada' });
        expect(enviados[0].dados).toMatchObject({
            disciplina: 'Calculo 1',
            destino: 'Cálculo I',
            vagas: 2
        });
    });

    it('uma vaga só: "vaga movida" no singular', async () => {
        repo.buscarDisciplina
            .mockResolvedValueOnce(pendente())
            .mockResolvedValueOnce({ id: 3, nome: 'Cálculo I', status: 'aprovada' });
        repo.mesclarDisciplina.mockResolvedValue({ vagas: 1, pontos: 0 });
        await painelService.mesclarDisciplina(31, 3, COORD);
        expect(repo.registrar.mock.calls[0][0].descricao).toMatch(/\(1 vaga movida\)$/);
    });

    it.each([
        [undefined, /Escolha a disciplina/],
        [NaN, /Escolha a disciplina/],
        [31, /diferente/]
    ])('destino %p: 400', async (destino, mensagem) => {
        await expect(painelService.mesclarDisciplina(31, destino, COORD)).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringMatching(mensagem)
        });
    });

    it('destino pendente ou inexistente: 400; origem revisada ao mesmo tempo: 409', async () => {
        repo.buscarDisciplina
            .mockResolvedValueOnce(pendente())
            .mockResolvedValueOnce(pendente({ id: 33 }));
        await expect(painelService.mesclarDisciplina(31, 33, COORD)).rejects.toMatchObject({
            statusCode: 400
        });
        repo.buscarDisciplina.mockResolvedValueOnce(pendente()).mockResolvedValueOnce(null);
        await expect(painelService.mesclarDisciplina(31, 99, COORD)).rejects.toMatchObject({
            statusCode: 400
        });
        repo.buscarDisciplina
            .mockResolvedValueOnce(pendente())
            .mockResolvedValueOnce({ id: 3, nome: 'Cálculo I', status: 'aprovada' });
        repo.mesclarDisciplina.mockResolvedValue(null);
        await expect(painelService.mesclarDisciplina(31, 3, COORD)).rejects.toMatchObject({
            statusCode: 409
        });
        expect(repo.registrar).not.toHaveBeenCalled();
    });
});

describe('E-mails', () => {
    it('aprovada e mesclada', () => {
        const a = montar('disciplina-aprovada', { nome: 'Carlos Mendes', disciplina: 'POO' });
        expect(a.assunto).toBe('Disciplina aprovada: POO');
        const m = montar('disciplina-mesclada', {
            nome: 'Carlos Mendes',
            disciplina: 'Calculo 1',
            destino: 'Cálculo I',
            vagas: 2
        });
        expect(m.assunto).toBe('Sua disciplina "Calculo 1" passou para "Cálculo I"');
        expect(m.texto).toMatch(/Vagas movidas: 2/);
    });
});

describe('Rotas /admin/disciplinas', () => {
    const coord = gerarToken({ id: 50, nome_completo: 'Profa. Helena', tipo: 'coordenador' });
    const com = (req, token) => req.set('Cookie', `monipro_sessao=${token}`);

    it('aluno e monitor recebem 403', async () => {
        for (const tipo of ['aluno', 'monitor']) {
            const t = gerarToken({ id: 1, tipo });
            expect((await com(request(app).get('/admin/disciplinas'), t)).status).toBe(403);
            expect((await com(request(app).post('/admin/disciplinas/31/aprovar'), t)).status).toBe(
                403
            );
            expect((await com(request(app).post('/admin/disciplinas/31/mesclar'), t)).status).toBe(
                403
            );
        }
    });

    it('lista, aprova e mescla pela coordenação', async () => {
        repo.listarDisciplinasPendentes.mockResolvedValue([]);
        repo.listarDisciplinasAprovadas.mockResolvedValue(APROVADAS);
        const l = await com(request(app).get('/admin/disciplinas'), coord);
        expect(l.body).toMatchObject({ success: true, disciplinas: [], aprovadas: APROVADAS });

        repo.buscarDisciplina.mockResolvedValue(pendente());
        repo.aprovarDisciplina.mockResolvedValue(1);
        expect((await com(request(app).post('/admin/disciplinas/31/aprovar'), coord)).status).toBe(
            200
        );

        repo.buscarDisciplina
            .mockResolvedValueOnce(pendente())
            .mockResolvedValueOnce({ id: 3, nome: 'Cálculo I', status: 'aprovada' });
        repo.mesclarDisciplina.mockResolvedValue({ vagas: 0, pontos: 0 });
        const m = await com(request(app).post('/admin/disciplinas/31/mesclar'), coord).send({
            id_destino: 3
        });
        expect(m.status).toBe(200);
        expect((await com(request(app).post('/admin/disciplinas/31/mesclar'), coord)).status).toBe(
            400
        );
        const ruim = await com(request(app).post('/admin/disciplinas/x/aprovar'), coord);
        expect(ruim.status).toBe(400);
        expect(ruim.body.erro).toBe('Disciplina inválida.');
    });
});
