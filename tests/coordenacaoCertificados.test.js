// Plano 7, PR 2: a coordenação assina e revoga certificados pelo painel. O banco real fica com
// tests/integracao/coordenacaoCertificados.int.test.js.
jest.mock('../src/repositories/painelRepository');
jest.mock('../src/repositories/certificadoRepository');

const request = require('supertest');
const repo = require('../src/repositories/painelRepository');
const certRepo = require('../src/repositories/certificadoRepository');
const painelService = require('../src/services/painelService');
const certificadoService = require('../src/services/certificadoService');
const { enviados } = require('../src/services/email');
const { montar } = require('../src/services/email/modelos');
const { gerarToken } = require('./helpers/token');
const app = require('../src/app');

const AGORA = new Date('2026-11-21T15:00:00.000Z');
const COORD = { id: 50, nome: 'Profa. Helena' };
const CODIGO = 'K7QF2M9XHB4TP3ZD8WQA71LCTN';

function certificado(extra = {}) {
    return {
        id: 41,
        codigo: CODIGO,
        periodo: '2026.2',
        carga_minutos: 2880,
        situacao: 'valido',
        emitido_em: new Date('2026-11-19T12:00:00.000Z'),
        assinado_em: null,
        assinante_nome: null,
        id_usuario: 7,
        usuario: { nome_completo: 'Ana Ribeiro' },
        snapshot: {
            sessoes_total: 2,
            sessoes: [
                { data: '2026-11-10T17:00:00.000Z', disciplina: 'Cálculo I', minutos: 90 },
                { data: '2026-11-12T17:00:00.000Z', disciplina: 'Física I', minutos: 120 }
            ]
        },
        ...extra
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    enviados.length = 0;
    // A transação do repositório só repassa um "tx" falso para a função
    repo.emTransacao.mockImplementation((fn) => fn('tx'));
    repo.registrar.mockImplementation(async (dados) => ({ ...dados, criado_em: AGORA }));
    repo.contatoDoUsuario.mockResolvedValue({ nome: 'Ana Ribeiro', email: 'ana@exemplo.invalid' });
});

// Os e-mails saem sem esperar (enviarSemEsperar): dá uma volta no event loop antes de conferir
const esperarEmails = () => new Promise((r) => setImmediate(r));

describe('Lista e sessões', () => {
    it('pendentes: todos os semestres; assinados: só do semestre pedido (padrão: o atual)', async () => {
        repo.listarCertificados.mockResolvedValue([certificado()]);
        const [linha] = await painelService.certificados('pendente', undefined, AGORA);
        expect(repo.listarCertificados).toHaveBeenLastCalledWith({
            situacao: 'pendente',
            periodo: undefined
        });
        expect(linha).toMatchObject({ id: 41, monitor: 'Ana Ribeiro', sessoes: 2 });
        expect(linha).not.toHaveProperty('snapshot');

        await painelService.certificados('assinado', undefined, AGORA);
        expect(repo.listarCertificados).toHaveBeenLastCalledWith({
            situacao: 'assinado',
            periodo: '2026.2'
        });
    });

    it('snapshot antigo sem total de sessões: mostra vazio em vez de inventar', async () => {
        repo.listarCertificados.mockResolvedValue([certificado({ snapshot: {} })]);
        const [linha] = await painelService.certificados('pendente', undefined, AGORA);
        expect(linha.sessoes).toBeNull();
    });

    it('sessões vêm do snapshot da emissão', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado());
        const r = await painelService.sessoesDoCertificado(41);
        expect(r.sessoes).toHaveLength(2);
        expect(r.sessoes[1]).toEqual({
            data: '2026-11-12T17:00:00.000Z',
            disciplina: 'Física I',
            minutos: 120
        });
        repo.buscarCertificado.mockResolvedValue(certificado({ snapshot: {} }));
        expect((await painelService.sessoesDoCertificado(41)).sessoes).toEqual([]);
    });

    it('certificado inexistente: 404', async () => {
        repo.buscarCertificado.mockResolvedValue(null);
        await expect(painelService.sessoesDoCertificado(9)).rejects.toMatchObject({
            statusCode: 404
        });
    });
});

describe('Assinar', () => {
    it('grava a assinatura e a auditoria na mesma transação e avisa o monitor', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado());
        repo.assinarCertificado.mockResolvedValue(1);

        const r = await painelService.assinarCertificado(41, COORD, AGORA);

        expect(repo.assinarCertificado).toHaveBeenCalledWith(
            41,
            { idAssinante: 50, nome: 'Profa. Helena', quando: AGORA },
            'tx'
        );
        expect(repo.registrar).toHaveBeenCalledWith(
            expect.objectContaining({
                id_usuario: 50,
                acao: 'assinar_certificado',
                alvo: 'certificado:41',
                descricao: 'Assinou o certificado de Ana Ribeiro (2026.2, 48h)'
            }),
            'tx'
        );
        expect(r.certificado).toMatchObject({ assinado_em: AGORA, assinante: 'Profa. Helena' });
        expect(r.registro.usuario).toBe('Profa. Helena');

        await esperarEmails();
        expect(enviados).toHaveLength(1);
        expect(enviados[0]).toMatchObject({
            para: 'ana@exemplo.invalid',
            modelo: 'certificado-assinado'
        });
        expect(enviados[0].dados.codigo).toBe('K7QF-2M9X-HB4T-P3ZD-8WQA-71LC-TN');
    });

    it.each([
        [{ situacao: 'revogado' }, 409, /revogado/],
        [{ situacao: 'substituido' }, 409, /substituído/],
        [{ assinado_em: new Date() }, 409, /já foi assinado/]
    ])('não assina %o', async (extra, status, mensagem) => {
        repo.buscarCertificado.mockResolvedValue(certificado(extra));
        await expect(painelService.assinarCertificado(41, COORD, AGORA)).rejects.toMatchObject({
            statusCode: status,
            message: expect.stringMatching(mensagem)
        });
        expect(repo.assinarCertificado).not.toHaveBeenCalled();
        expect(repo.registrar).not.toHaveBeenCalled();
    });

    it('outra pessoa assinou no mesmo instante: 409 e nada de auditoria', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado());
        repo.assinarCertificado.mockResolvedValue(0);
        await expect(painelService.assinarCertificado(41, COORD, AGORA)).rejects.toMatchObject({
            statusCode: 409
        });
        expect(repo.registrar).not.toHaveBeenCalled();
    });

    it('conta do monitor excluída: assina sem mandar e-mail', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado());
        repo.assinarCertificado.mockResolvedValue(1);
        repo.contatoDoUsuario.mockResolvedValue(null);
        await painelService.assinarCertificado(41, COORD, AGORA);
        await esperarEmails();
        expect(enviados).toHaveLength(0);
    });
});

describe('Revogar', () => {
    it('exige motivo de 10 a 300 caracteres', async () => {
        for (const motivo of [undefined, '   curto  ', 'x'.repeat(301)]) {
            await expect(
                painelService.revogarCertificado(41, motivo, COORD, AGORA)
            ).rejects.toMatchObject({ statusCode: 400 });
        }
        expect(repo.buscarCertificado).not.toHaveBeenCalled();
    });

    it('revoga (assinado ou não), registra e manda o motivo ao monitor', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado({ assinado_em: AGORA }));
        certRepo.revogar.mockResolvedValue(1);
        const motivo = 'Sessões registradas sem alunos presentes.';

        await painelService.revogarCertificado(41, `  ${motivo} `, COORD, AGORA);

        expect(certRepo.revogar).toHaveBeenCalledWith(41, motivo, AGORA, 'tx');
        expect(repo.registrar.mock.calls[0][0]).toMatchObject({
            acao: 'revogar_certificado',
            descricao: `Revogou o certificado de Ana Ribeiro (2026.2): ${motivo}`
        });
        await esperarEmails();
        expect(enviados[0]).toMatchObject({ modelo: 'certificado-revogado' });
        expect(enviados[0].dados.motivo).toBe(motivo);
    });

    it('o substituído também pode ser revogado', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado({ situacao: 'substituido' }));
        certRepo.revogar.mockResolvedValue(1);
        await painelService.revogarCertificado(41, 'Horas não confirmadas.', COORD, AGORA);
        expect(certRepo.revogar).toHaveBeenCalled();
    });

    it('já revogado ou revogado ao mesmo tempo: 409', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado({ situacao: 'revogado' }));
        await expect(
            painelService.revogarCertificado(41, 'Horas não confirmadas.', COORD, AGORA)
        ).rejects.toMatchObject({ statusCode: 409 });

        repo.buscarCertificado.mockResolvedValue(certificado());
        certRepo.revogar.mockResolvedValue(0);
        await expect(
            painelService.revogarCertificado(41, 'Horas não confirmadas.', COORD, AGORA)
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(repo.registrar).not.toHaveBeenCalled();
    });

    it('descrição longa na auditoria fica em 300 caracteres', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado());
        certRepo.revogar.mockResolvedValue(1);
        await painelService.revogarCertificado(41, 'm'.repeat(300), COORD, AGORA);
        expect(repo.registrar.mock.calls[0][0].descricao).toHaveLength(300);
    });
});

describe('Documento e verificação mostram a assinatura', () => {
    it('verificação pública: quem assinou e quando, sem dado pessoal a mais', async () => {
        certRepo.buscarPorCodigo.mockResolvedValue({
            ...certificado({ assinado_em: AGORA, assinante_nome: 'Profa. Helena' }),
            snapshot: { nome: 'Ana Ribeiro' }
        });
        const v = await certificadoService.verificar(CODIGO);
        expect(v).toMatchObject({ assinado_em: AGORA, assinante: 'Profa. Helena' });
        expect(v).not.toHaveProperty('id_assinante');
    });

    it('sem assinatura, os campos nem aparecem', async () => {
        certRepo.buscarPorCodigo.mockResolvedValue({ ...certificado(), snapshot: { nome: 'Ana' } });
        const v = await certificadoService.verificar(CODIGO);
        expect(v).not.toHaveProperty('assinado_em');
        expect(v).not.toHaveProperty('assinante');
    });
});

describe('E-mails', () => {
    const base = {
        nome: 'Ana Ribeiro',
        semestre: '2º semestre de 2026',
        carga_minutos: 2880,
        codigo: 'K7QF'
    };

    it('assinado: diz quem assinou', () => {
        const m = montar('certificado-assinado', { ...base, assinante: 'Profa. Helena' });
        expect(m.assunto).toBe('Sua declaração de horas de 2º semestre de 2026 foi assinada');
        expect(m.texto).toMatch(/Profa\. Helena/);
        expect(m.texto).toMatch(/48h/);
    });

    it('revogado: traz o motivo escapado no HTML', () => {
        const m = montar('certificado-revogado', {
            ...base,
            carga_minutos: 95,
            motivo: '<b>sem alunos</b>'
        });
        expect(m.texto).toMatch(/1h35/);
        expect(m.html).toMatch(/&lt;b&gt;sem alunos/);
        expect(m.html).not.toMatch(/<b>sem alunos/);
    });
});

describe('Rotas /admin/certificados', () => {
    const coord = gerarToken({ id: 50, nome_completo: 'Profa. Helena', tipo: 'coordenador' });
    const com = (req, token) => req.set('Cookie', `monipro_sessao=${token}`);

    it('aluno e monitor recebem 403 em todas', async () => {
        for (const tipo of ['aluno', 'monitor']) {
            const t = gerarToken({ id: 1, tipo });
            expect((await com(request(app).get('/admin/certificados'), t)).status).toBe(403);
            expect((await com(request(app).post('/admin/certificados/1/assinar'), t)).status).toBe(
                403
            );
            expect((await com(request(app).post('/admin/certificados/1/revogar'), t)).status).toBe(
                403
            );
        }
    });

    it('lista com situação válida e recusa a inválida', async () => {
        repo.listarCertificados.mockResolvedValue([]);
        const ok = await com(
            request(app).get('/admin/certificados?situacao=assinado&periodo=2026.1'),
            coord
        );
        expect(ok.status).toBe(200);
        expect(repo.listarCertificados).toHaveBeenLastCalledWith({
            situacao: 'assinado',
            periodo: '2026.1'
        });
        expect((await com(request(app).get('/admin/certificados'), coord)).status).toBe(200);
        const ruim = await com(request(app).get('/admin/certificados?situacao=todos'), coord);
        expect(ruim.status).toBe(400);
    });

    it('id inválido: 400', async () => {
        const r = await com(request(app).get('/admin/certificados/abc/sessoes'), coord);
        expect(r.status).toBe(400);
    });

    it('sessões, assinar e revogar usam o coordenador da sessão', async () => {
        repo.buscarCertificado.mockResolvedValue(certificado());
        repo.assinarCertificado.mockResolvedValue(1);
        certRepo.revogar.mockResolvedValue(1);

        expect(
            (await com(request(app).get('/admin/certificados/41/sessoes'), coord)).body.sessoes
        ).toHaveLength(2);

        const a = await com(request(app).post('/admin/certificados/41/assinar'), coord);
        expect(a.status).toBe(200);
        expect(repo.assinarCertificado.mock.calls[0][1]).toMatchObject({
            idAssinante: 50,
            nome: 'Profa. Helena'
        });

        const r = await com(request(app).post('/admin/certificados/41/revogar'), coord).send({
            motivo: 'Sessões sem alunos presentes.'
        });
        expect(r.status).toBe(200);
        const semCorpo = await com(request(app).post('/admin/certificados/41/revogar'), coord);
        expect(semCorpo.status).toBe(400);
    });
});
