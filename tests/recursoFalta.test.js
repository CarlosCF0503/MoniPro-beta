// Plano 7: o aluno pede revisão da falta com um comprovante; a coordenação aceita ou recusa.
// O banco real fica com tests/integracao/recursoFalta.int.test.js.
jest.mock('../src/repositories/recursoRepository');
jest.mock('../src/repositories/painelRepository');

const request = require('supertest');
const recRepo = require('../src/repositories/recursoRepository');
const painelRepo = require('../src/repositories/painelRepository');
const recursoService = require('../src/services/recursoService');
const { lerComprovante, nomeSeguro, TAMANHO_MAXIMO } = require('../src/utils/comprovante');
const { enviados } = require('../src/services/email');
const { montar } = require('../src/services/email/modelos');
const { gerarToken } = require('./helpers/token');
const app = require('../src/app');

const D = 24 * 3600e3;
const AGORA = new Date('2026-11-21T15:00:00.000Z');
const COORD = { id: 50, nome: 'Profa. Helena' };
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200, 1)]);
const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(50)
]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(50)]);
const arquivo = (buf = PDF, tipo = 'application/pdf', nome = 'atestado.pdf') => ({
    nome,
    tipo,
    conteudo: buf.toString('base64')
});
const corpo = (extra = {}) => ({
    justificativa: 'Consulta médica no horário.',
    arquivo: arquivo(),
    ...extra
});
const esperarEmails = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
    jest.clearAllMocks();
    enviados.length = 0;
    recRepo.emTransacao.mockImplementation((fn) => fn('tx'));
    painelRepo.registrar.mockImplementation(async (d) => ({ ...d, criado_em: AGORA }));
    painelRepo.contatoDoUsuario.mockResolvedValue({
        nome: 'Diego Martins',
        email: 'diego@exemplo.invalid'
    });
});

describe('Comprovante', () => {
    it.each([
        [PDF, 'application/pdf'],
        [PNG, 'image/png'],
        [JPG, 'image/jpeg']
    ])('aceita %#', (buf, tipo) => {
        const r = lerComprovante(arquivo(buf, tipo, 'x'));
        expect(r).toMatchObject({ tipo, tamanho: buf.length });
        expect(r.conteudo.equals(buf)).toBe(true);
    });

    it.each([
        [undefined, /Anexe/],
        [{ tipo: 'image/gif', conteudo: 'R0lG' }, /PDF, JPG ou PNG/],
        [{ tipo: 'application/pdf', conteudo: '' }, /ler o arquivo/],
        [{ tipo: 'application/pdf', conteudo: 'não é base64!' }, /ler o arquivo/],
        [{ tipo: 'application/pdf', conteudo: '====' }, /ler o arquivo/],
        [arquivo(PNG, 'application/pdf'), /não é um PDF/],
        [arquivo(Buffer.from('<script>alert(1)</script>'), 'image/png'), /não é um PDF, JPG ou PNG/]
    ])('recusa %#', (a, mensagem) => expect(lerComprovante(a).erro).toMatch(mensagem));

    it('recusa acima de 5 MB antes de decodificar tudo', () => {
        const grande = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(TAMANHO_MAXIMO)]);
        expect(lerComprovante(arquivo(grande)).erro).toMatch(/5 MB/);
    });

    it('5 MB exatos passam', () => {
        const exato = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(TAMANHO_MAXIMO - 5)]);
        expect(lerComprovante(arquivo(exato)).tamanho).toBe(TAMANHO_MAXIMO);
    });

    it('nome sem caminho, sem caracteres perigosos, com padrão quando vazio', () => {
        expect(nomeSeguro('C:\\fotos\\..\\atestado "x".pdf', 'application/pdf')).toBe(
            'atestado x.pdf'
        );
        expect(nomeSeguro('../../etc/passwd', 'image/png')).toBe('passwd');
        expect(nomeSeguro('\u0000\u0007', 'image/jpeg')).toBe('comprovante.jpg');
        expect(nomeSeguro('a'.repeat(300), 'application/pdf')).toHaveLength(120);
    });
});

describe('Aluno pede a revisão', () => {
    const insc = (extra = {}) => ({
        id: 9,
        id_aluno: 4,
        ausente_em: new Date(AGORA - 2 * D),
        horario: new Date(AGORA - 3 * D),
        ...extra
    });

    it('grava o pedido com o arquivo e sem registrar dado de saúde no log', async () => {
        recRepo.bloquearInscricao.mockResolvedValue(insc());
        recRepo.buscarPorAgendamento.mockResolvedValue(null);
        recRepo.criar.mockResolvedValue({
            status: 'pendente',
            criado_em: AGORA,
            motivo_decisao: null
        });
        const r = await recursoService.pedir(9, 4, corpo(), AGORA);
        expect(r).toMatchObject({ status: 'pendente' });
        const dados = recRepo.criar.mock.calls[0][0];
        expect(dados).toMatchObject({
            id_agendamento: 9,
            id_aluno: 4,
            justificativa: 'Consulta médica no horário.',
            arquivo_nome: 'atestado.pdf',
            arquivo_tipo: 'application/pdf',
            arquivo_tamanho: PDF.length
        });
        expect(Buffer.isBuffer(dados.arquivo)).toBe(true);
    });

    it.each([
        [{ justificativa: 'curta' }, /10 a 500/],
        [{ justificativa: 'x'.repeat(501) }, /10 a 500/],
        [{ arquivo: undefined }, /Anexe/]
    ])('validação %#', async (extra, mensagem) => {
        await expect(recursoService.pedir(9, 4, corpo(extra), AGORA)).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringMatching(mensagem)
        });
        expect(recRepo.emTransacao).not.toHaveBeenCalled();
    });

    it.each([
        [null, 404],
        [insc({ id_aluno: 99 }), 404],
        [insc({ ausente_em: null }), 409],
        [insc({ ausente_em: new Date(AGORA - 31 * D) }), 422]
    ])('não aceita %#', async (ag, status) => {
        recRepo.bloquearInscricao.mockResolvedValue(ag);
        await expect(recursoService.pedir(9, 4, corpo(), AGORA)).rejects.toMatchObject({
            statusCode: status
        });
        expect(recRepo.criar).not.toHaveBeenCalled();
    });

    it('segundo pedido para a mesma falta: 409', async () => {
        recRepo.bloquearInscricao.mockResolvedValue(insc());
        recRepo.buscarPorAgendamento.mockResolvedValue({ id: 3 });
        await expect(recursoService.pedir(9, 4, corpo(), AGORA)).rejects.toMatchObject({
            statusCode: 409
        });
    });
});

describe('Coordenação decide', () => {
    const pendente = (extra = {}) => ({
        id: 3,
        id_agendamento: 9,
        id_aluno: 4,
        status: 'pendente',
        criado_em: AGORA,
        ...extra
    });
    const linha = {
        ...pendente(),
        justificativa: 'Consulta médica.',
        arquivo_nome: 'a.pdf',
        arquivo_tipo: 'application/pdf',
        arquivo_tamanho: 1234,
        agendamento: {
            aluno: { nome_completo: 'Diego' },
            monitoria: {
                horario: AGORA,
                monitor: { nome_completo: 'Ana' },
                disciplina: { nome: 'Cálculo I' }
            }
        }
    };

    it('lista pendentes sem os bytes do arquivo', async () => {
        recRepo.listarPendentes.mockResolvedValue([linha]);
        const [r] = await recursoService.pendentes();
        expect(r).toEqual({
            id: 3,
            id_agendamento: 9,
            aluno: 'Diego',
            monitor: 'Ana',
            disciplina: 'Cálculo I',
            horario: AGORA,
            justificativa: 'Consulta médica.',
            criado_em: AGORA,
            arquivo: { nome: 'a.pdf', tipo: 'application/pdf', tamanho: 1234 }
        });
    });

    it('aceitar anula a falta, registra e responde ao aluno', async () => {
        recRepo.buscar.mockResolvedValue(pendente());
        recRepo.decidir.mockResolvedValue(1);
        await recursoService.aceitar(3, COORD, AGORA);
        expect(painelRepo.anularFalta).toHaveBeenCalledWith(9, 'tx');
        expect(recRepo.decidir).toHaveBeenCalledWith(
            3,
            { status: 'aceito', idDecisor: 50, quando: AGORA },
            'tx'
        );
        expect(painelRepo.registrar.mock.calls[0][0]).toMatchObject({
            acao: 'aceitar_recurso',
            alvo: 'agendamento:9'
        });
        await esperarEmails();
        expect(enviados[0]).toMatchObject({
            para: 'diego@exemplo.invalid',
            modelo: 'recurso-aceito'
        });
    });

    it('recusar exige motivo, mantém a falta e manda o motivo', async () => {
        await expect(recursoService.recusar(3, 'curto', COORD, AGORA)).rejects.toMatchObject({
            statusCode: 400
        });
        recRepo.buscar.mockResolvedValue(pendente());
        recRepo.decidir.mockResolvedValue(1);
        await recursoService.recusar(3, 'O atestado é de outra data.', COORD, AGORA);
        expect(painelRepo.anularFalta).not.toHaveBeenCalled();
        expect(recRepo.decidir.mock.calls[0][1]).toMatchObject({
            status: 'recusado',
            motivo: 'O atestado é de outra data.'
        });
        await esperarEmails();
        expect(enviados[0]).toMatchObject({ modelo: 'recurso-recusado' });
        expect(enviados[0].dados.motivo).toBe('O atestado é de outra data.');
    });

    it('inexistente 404; já decidido ou decidido ao mesmo tempo 409', async () => {
        recRepo.buscar.mockResolvedValue(null);
        await expect(recursoService.aceitar(3, COORD, AGORA)).rejects.toMatchObject({
            statusCode: 404
        });
        recRepo.buscar.mockResolvedValue(pendente({ status: 'aceito' }));
        await expect(recursoService.aceitar(3, COORD, AGORA)).rejects.toMatchObject({
            statusCode: 409
        });
        recRepo.buscar.mockResolvedValue(pendente());
        recRepo.decidir.mockResolvedValue(0);
        await expect(
            recursoService.recusar(3, 'Motivo bem explicado.', COORD, AGORA)
        ).rejects.toMatchObject({
            statusCode: 409
        });
        await expect(recursoService.aceitar(3, COORD, AGORA)).rejects.toMatchObject({
            statusCode: 409
        });
        expect(painelRepo.registrar).not.toHaveBeenCalled();
    });

    it('arquivo apagado pela retenção: 404', async () => {
        recRepo.buscarArquivo.mockResolvedValue(null);
        await expect(recursoService.arquivo(3)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('e-mails', () => {
        expect(
            montar('recurso-aceito', { nome: 'Diego Martins', enviado_em: '20/11' }).assunto
        ).toBe('Seu pedido de revisão da falta foi aceito');
        const r = montar('recurso-recusado', {
            nome: 'Diego',
            enviado_em: '20/11',
            motivo: '<i>data errada</i>'
        });
        expect(r.html).toMatch(/&lt;i&gt;data errada/);
    });
});

describe('Rotas', () => {
    const com = (req, token) => req.set('Cookie', `monipro_sessao=${token}`);
    const aluno = gerarToken({ id: 4, tipo: 'aluno' });
    const coord = gerarToken({ id: 50, nome_completo: 'Profa. Helena', tipo: 'coordenador' });

    it('só o aluno pede; corpo de até 7 MB é aceito nesta rota', async () => {
        for (const tipo of ['monitor', 'coordenador']) {
            const r = await com(
                request(app).post('/agendamentos/9/recurso'),
                gerarToken({ id: 1, tipo })
            ).send(corpo());
            expect(r.status).toBe(403);
        }
        recRepo.bloquearInscricao.mockResolvedValue({
            id: 9,
            id_aluno: 4,
            ausente_em: new Date(),
            horario: new Date()
        });
        recRepo.buscarPorAgendamento.mockResolvedValue(null);
        recRepo.criar.mockResolvedValue({
            status: 'pendente',
            criado_em: AGORA,
            motivo_decisao: null
        });
        const grande = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(3 * 1024 * 1024)]);
        const ok = await com(request(app).post('/agendamentos/9/recurso'), aluno).send(
            corpo({ arquivo: arquivo(grande) })
        );
        expect(ok.status).toBe(201);
        expect(ok.body.recurso).toMatchObject({ status: 'pendente' });
        expect(
            (await com(request(app).post('/agendamentos/x/recurso'), aluno).send(corpo())).status
        ).toBe(404);
    });

    it('as outras rotas continuam com o limite padrão de corpo', async () => {
        const r = await com(request(app).post('/agendamentos'), aluno).send({
            id_monitoria: 1,
            lixo: 'x'.repeat(200 * 1024)
        });
        expect(r.status).toBe(413);
    });

    it('arquivo: só a coordenação, aberto no navegador sem cache e sem script', async () => {
        expect((await com(request(app).get('/admin/recursos/3/arquivo'), aluno)).status).toBe(403);
        recRepo.buscarArquivo.mockResolvedValue({
            arquivo: PDF,
            arquivo_nome: 'atestado médico.pdf',
            arquivo_tipo: 'application/pdf'
        });
        const r = await com(request(app).get('/admin/recursos/3/arquivo'), coord);
        expect(r.status).toBe(200);
        expect(r.headers['content-type']).toBe('application/pdf');
        expect(r.headers['content-disposition']).toBe(
            'inline; filename="atestado_m_dico.pdf"; filename*=UTF-8\'\'atestado%20m%C3%A9dico.pdf'
        );
        expect(r.headers['cache-control']).toBe('no-store, private');
        expect(r.headers['content-security-policy']).toMatch(/default-src 'none'.*sandbox/);
        expect(Buffer.from(r.body).equals(PDF)).toBe(true);
    });

    it('aceitar e recusar pela coordenação; aluno 403; id inválido 400', async () => {
        expect((await com(request(app).post('/admin/recursos/3/aceitar'), aluno)).status).toBe(403);
        recRepo.buscar.mockResolvedValue({
            id: 3,
            id_agendamento: 9,
            id_aluno: 4,
            status: 'pendente',
            criado_em: AGORA
        });
        recRepo.decidir.mockResolvedValue(1);
        expect((await com(request(app).post('/admin/recursos/3/aceitar'), coord)).status).toBe(200);
        const rec = await com(request(app).post('/admin/recursos/3/recusar'), coord).send({
            motivo: 'Data diferente da falta.'
        });
        expect(rec.status).toBe(200);
        const ruim = await com(request(app).post('/admin/recursos/x/aceitar'), coord);
        expect(ruim.status).toBe(400);
        expect(ruim.body.erro).toBe('Pedido inválido.');
    });
});
