// Plano 7 (RF-012, RN-014): painel da coordenação. As contas do painel, o acesso às rotas
// /admin/* e o script que cria a conta. O banco real fica com
// tests/integracao/painelCoordenacao.int.test.js.
jest.mock('../src/repositories/painelRepository');

const request = require('supertest');
const repo = require('../src/repositories/painelRepository');
const painelService = require('../src/services/painelService');
const {
    inicioDaSemana,
    diaEHoraNoCampus,
    turnoDaHora,
    resumirSemestre,
    resumirMonitores
} = require('../src/utils/painelCoordenacao');
const { periodoAnterior } = require('../src/utils/periodo');
const {
    cadastroSchema,
    loginSchema,
    esqueciSenhaSchema
} = require('../src/schemas/autenticacaoSchemas');
const script = require('../scripts/criar-coordenador');
const { gerarToken } = require('./helpers/token');
const app = require('../src/app');

const H = 60 * 60 * 1000;
const D = 24 * H;
// Sábado, 21/11/2026, 12:00 em Brasília
const AGORA = new Date('2026-11-21T15:00:00.000Z');
const INICIO = new Date('2026-07-01T03:00:00.000Z');
const FIM = new Date('2027-01-01T03:00:00.000Z');

const MONITOR_A = { nome: 'Ana Ribeiro', email: 'ana@exemplo.invalid' };
const MONITOR_B = { nome: 'Bruno Lima', email: 'bruno@exemplo.invalid' };

/** Vaga finalizada de 90 min, por padrão com uma presença confirmada. */
function vaga(horarioIso, extra = {}) {
    const horario = new Date(horarioIso);
    return {
        horario,
        data_fim: new Date(horario.getTime() + 90 * 60000),
        status: 'realizada',
        id_monitor: 1,
        monitor: MONITOR_A,
        disciplina: 'Cálculo I',
        inscricoes: [{ id_aluno: 10, status: 'concluido', ausente_em: null }],
        ...extra
    };
}

beforeEach(() => jest.clearAllMocks());

describe('Datas no fuso do campus', () => {
    it('a semana começa na segunda às 00:00 de Brasília', () => {
        // Domingo 22/11 às 23:00 em Brasília ainda é a semana da segunda 16/11
        expect(inicioDaSemana(new Date('2026-11-23T02:00:00.000Z')).toISOString()).toBe(
            '2026-11-16T03:00:00.000Z'
        );
        // Segunda 23/11 à 00:30 já é a semana nova
        expect(inicioDaSemana(new Date('2026-11-23T03:30:00.000Z')).toISOString()).toBe(
            '2026-11-23T03:00:00.000Z'
        );
    });

    it('dia da semana e hora seguem Brasília, não UTC', () => {
        // 01:00 UTC de terça = 22:00 de segunda em Brasília
        expect(diaEHoraNoCampus(new Date('2026-11-17T01:00:00.000Z'))).toEqual({
            dia: 0,
            hora: 22
        });
    });

    it.each([
        [9, 'manha'],
        [11, 'manha'],
        [12, 'tarde'],
        [17, 'tarde'],
        [18, 'noite'],
        [23, 'noite']
    ])('%i h é %s', (hora, turno) => expect(turnoDaHora(hora)).toBe(turno));

    it.each([
        ['2026.2', '2026.1'],
        ['2026.1', '2025.2']
    ])('o semestre antes de %s é %s', (p, esperado) => expect(periodoAnterior(p)).toBe(esperado));
});

describe('Indicadores do semestre', () => {
    const janela = { inicio: INICIO, fim: FIM, agora: AGORA };

    it('conta só a vaga finalizada com presença dos dois lados como sessão', () => {
        const vagas = [
            vaga('2026-11-10T17:00:00.000Z'),
            // finalizada, mas ninguém confirmou: não conta
            vaga('2026-11-11T17:00:00.000Z', {
                inscricoes: [{ id_aluno: 11, status: 'pendente', ausente_em: null }]
            }),
            // horário passou e o monitor não finalizou: não conta
            vaga('2026-11-12T17:00:00.000Z', { status: 'ativa', data_fim: null })
        ];
        const r = resumirSemestre(vagas, janela);
        expect(r).toMatchObject({ sessoes: 1, minutos: 90, alunos: 1 });
        expect(r.por_disciplina).toEqual([{ nome: 'Cálculo I', minutos: 90 }]);
    });

    it('separa presença, falta, sem confirmação e vaga cancelada pelo monitor', () => {
        const vagas = [
            vaga('2026-11-10T17:00:00.000Z', {
                inscricoes: [
                    { id_aluno: 10, status: 'concluido', ausente_em: null },
                    {
                        id_aluno: 11,
                        status: 'pendente',
                        ausente_em: new Date('2026-11-10T19:00:00Z')
                    },
                    { id_aluno: 12, status: 'pendente', ausente_em: null }
                ]
            }),
            vaga('2026-11-12T17:00:00.000Z', {
                status: 'cancelada',
                data_fim: null,
                inscricoes: [{ id_aluno: 13, status: 'pendente', ausente_em: null }]
            })
        ];
        const r = resumirSemestre(vagas, janela);
        expect(r.inscricoes).toEqual({
            presentes: 1,
            faltas: 1,
            sem_confirmacao: 1,
            canceladas_monitor: 1
        });
        expect(r.faltas).toBe(1);
        expect(r.taxa_presenca).toBe(0.5);
    });

    it('sem presença nem falta, a taxa de presença fica vazia', () => {
        expect(resumirSemestre([], janela).taxa_presenca).toBeNull();
    });

    it('a sessão de 5h vale 4h, como no certificado', () => {
        const v = vaga('2026-11-10T17:00:00.000Z', {
            data_fim: new Date('2026-11-10T22:00:00.000Z')
        });
        expect(resumirSemestre([v], janela).minutos).toBe(240);
    });

    it('semanas de segunda a domingo até agora, a última parcial', () => {
        const r = resumirSemestre(
            [vaga('2026-11-16T17:00:00.000Z'), vaga('2026-11-18T17:00:00.000Z')],
            janela
        );
        const ultima = r.por_semana[r.por_semana.length - 1];
        expect(r.por_semana[0].inicio.toISOString()).toBe('2026-06-29T03:00:00.000Z');
        expect(ultima).toMatchObject({ sessoes: 2, parcial: true });
        expect(ultima.inicio.toISOString()).toBe('2026-11-16T03:00:00.000Z');
        expect(r.por_semana.filter((s) => s.parcial)).toHaveLength(1);
    });

    it('semestre já encerrado: nenhuma semana parcial', () => {
        const r = resumirSemestre([], {
            inicio: new Date('2026-01-01T03:00:00.000Z'),
            fim: new Date('2026-07-01T03:00:00.000Z'),
            agora: AGORA
        });
        expect(r.por_semana.some((s) => s.parcial)).toBe(false);
        expect(r.por_semana.length).toBeGreaterThanOrEqual(26);
    });

    it('janela vazia (semestre que não começou) não tem semanas', () => {
        const r = resumirSemestre([], { inicio: FIM, fim: FIM, agora: AGORA });
        expect(r.por_semana).toEqual([]);
    });

    it('mapa de procura por dia (seg a sáb) e turno da vaga', () => {
        const vagas = [
            // segunda 16/11, 14:00 em Brasília: tarde
            vaga('2026-11-16T17:00:00.000Z', {
                inscricoes: [
                    { id_aluno: 10, status: 'concluido', ausente_em: null },
                    { id_aluno: 11, status: 'pendente', ausente_em: null }
                ]
            }),
            // quarta 18/11, 19:00 em Brasília: noite
            vaga('2026-11-18T22:00:00.000Z'),
            // domingo 15/11 fica fora do mapa
            vaga('2026-11-15T13:00:00.000Z')
        ];
        const { procura } = resumirSemestre(vagas, janela);
        expect(procura.tarde[0]).toBe(2);
        expect(procura.noite[2]).toBe(1);
        expect(procura.manha.reduce((a, b) => a + b, 0)).toBe(0);
    });

    it('disciplinas da que tem mais horas para a que tem menos', () => {
        const r = resumirSemestre(
            [
                vaga('2026-11-10T17:00:00.000Z', { disciplina: 'Física I' }),
                vaga('2026-11-11T17:00:00.000Z'),
                vaga('2026-11-12T17:00:00.000Z')
            ],
            janela
        );
        expect(r.por_disciplina.map((d) => d.nome)).toEqual(['Cálculo I', 'Física I']);
    });
});

describe('Tabela de monitores', () => {
    const opcoes = { fim: FIM, agora: AGORA, comCertificado: new Map([[2, true]]) };

    it('uma linha por monitor, de mais horas para menos, com presença e certificado', () => {
        const vagas = [
            vaga('2026-11-10T17:00:00.000Z'),
            vaga('2026-11-17T17:00:00.000Z', {
                id_monitor: 2,
                monitor: MONITOR_B,
                disciplina: 'Física I',
                data_fim: new Date('2026-11-17T20:00:00.000Z'),
                inscricoes: [
                    { id_aluno: 10, status: 'concluido', ausente_em: null },
                    { id_aluno: 11, status: 'pendente', ausente_em: new Date() }
                ]
            })
        ];
        const [primeiro, segundo] = resumirMonitores(vagas, opcoes);
        expect(primeiro).toMatchObject({
            id: 2,
            nome: 'Bruno Lima',
            sessoes: 1,
            minutos: 180,
            alunos: 1,
            presenca: 0.5,
            certificado: 'assinado',
            disciplinas: ['Física I']
        });
        expect(segundo).toMatchObject({ id: 1, minutos: 90, presenca: 1, certificado: 'nenhum' });
    });

    it('últimas 8 semanas terminam na semana atual', () => {
        const vagas = [
            vaga('2026-11-17T17:00:00.000Z'),
            vaga('2026-11-19T17:00:00.000Z'),
            vaga('2026-11-10T17:00:00.000Z'),
            // 10 semanas atrás: fora da janela das 8
            vaga('2026-09-08T17:00:00.000Z')
        ];
        const [m] = resumirMonitores(vagas, opcoes);
        expect(m.semanas).toEqual([0, 0, 0, 0, 0, 0, 1, 2]);
        expect(m.sessoes).toBe(4);
    });

    it('vaga cancelada não entra nas disciplinas do monitor', () => {
        const vagas = [
            vaga('2026-11-10T17:00:00.000Z', {
                status: 'cancelada',
                disciplina: 'Física I',
                inscricoes: []
            })
        ];
        const [m] = resumirMonitores(vagas, opcoes);
        expect(m).toMatchObject({ disciplinas: [], sessoes: 0, presenca: null });
    });

    it('empate em horas: mais sessões primeiro, depois pelo nome', () => {
        const curta = (id, nome, iso) =>
            vaga(iso, { id_monitor: id, monitor: { nome, email: 'x@x.invalid' } });
        const r = resumirMonitores(
            [
                curta(3, 'Carla', '2026-11-10T17:00:00.000Z'),
                curta(4, 'Beatriz', '2026-11-11T17:00:00.000Z')
            ],
            { fim: FIM, agora: AGORA }
        );
        expect(r.map((m) => m.nome)).toEqual(['Beatriz', 'Carla']);
    });
});

describe('Serviço do painel', () => {
    it('resumo: semestre atual, anterior para comparar e alunos bloqueados agora', async () => {
        repo.buscarVagas
            .mockResolvedValueOnce([vaga('2026-11-10T17:00:00.000Z')])
            .mockResolvedValueOnce([
                vaga('2026-05-10T17:00:00.000Z'),
                vaga('2026-05-12T17:00:00.000Z')
            ]);
        // Aluno 10: 3 faltas em 10 dias (bloqueado); aluno 11: 1 falta
        repo.buscarAusencias.mockResolvedValue([
            { id_aluno: 10, ausente_em: new Date(AGORA.getTime() - 3 * D) },
            { id_aluno: 10, ausente_em: new Date(AGORA.getTime() - 2 * D) },
            { id_aluno: 10, ausente_em: new Date(AGORA.getTime() - 1 * D) },
            { id_aluno: 11, ausente_em: new Date(AGORA.getTime() - 1 * D) }
        ]);
        const r = await painelService.resumo('2026.2', AGORA);
        expect(r).toMatchObject({
            periodo: '2026.2',
            rotulo_periodo: '2º semestre de 2026',
            periodos: ['2026.2', '2026.1', '2025.2', '2025.1'],
            periodo_anterior: '2026.1',
            sessoes: 1,
            anterior: { sessoes: 2, minutos: 180 }
        });
        expect(r.inscricoes.bloqueados).toBe(1);
        // A busca vai só até agora, não até o fim do semestre
        expect(repo.buscarVagas).toHaveBeenCalledWith(INICIO, AGORA);
    });

    it('sem número no semestre anterior, não há comparação', async () => {
        repo.buscarVagas.mockResolvedValue([]);
        repo.buscarAusencias.mockResolvedValue([]);
        const r = await painelService.resumo(undefined, AGORA);
        expect(r.periodo).toBe('2026.2');
        expect(r.anterior).toBeNull();
    });

    it('semestre que ainda não começou: não consulta as vagas', async () => {
        repo.buscarVagas.mockResolvedValue([]);
        repo.buscarAusencias.mockResolvedValue([]);
        const r = await painelService.resumo('2027.2', AGORA);
        expect(r.sessoes).toBe(0);
        // Só o anterior (2027.1) também é futuro: nenhuma busca de vagas
        expect(repo.buscarVagas).not.toHaveBeenCalled();
        repo.buscarVagas.mockClear();
        expect(await painelService.monitores('2027.1', AGORA)).toEqual([]);
        expect(repo.buscarVagas).not.toHaveBeenCalled();
    });

    it('monitores do semestre com quem já emitiu certificado', async () => {
        repo.buscarVagas.mockResolvedValue([vaga('2026-11-10T17:00:00.000Z')]);
        repo.monitoresComCertificado.mockResolvedValue(new Map([[1, false]]));
        const r = await painelService.monitores(undefined, AGORA);
        expect(r).toHaveLength(1);
        expect(r[0].certificado).toBe('pendente');
        expect(repo.monitoresComCertificado).toHaveBeenCalledWith('2026.2');
    });

    it('auditoria e registro passam para o repositório', async () => {
        repo.listarAuditoria.mockResolvedValue([{ acao: 'criar_coordenador' }]);
        expect(await painelService.auditoria()).toHaveLength(1);
        expect(repo.listarAuditoria).toHaveBeenCalledWith(20);
        await painelService.registrar({ id_usuario: 1, acao: 'x', alvo: 'y', descricao: 'z' });
        expect(repo.registrar).toHaveBeenCalled();
    });
});

describe('Rotas /admin/*', () => {
    const coord = gerarToken({ id: 50, tipo: 'coordenador' });
    const get = (url, token) => {
        const req = request(app).get(url);
        return token ? req.set('Cookie', `monipro_sessao=${token}`) : req;
    };

    beforeEach(() => {
        repo.buscarVagas.mockResolvedValue([]);
        repo.buscarAusencias.mockResolvedValue([]);
        repo.monitoresComCertificado.mockResolvedValue(new Map());
        repo.listarAuditoria.mockResolvedValue([]);
    });

    it.each(['/admin/resumo', '/admin/monitores', '/admin/auditoria'])(
        '%s: sem login 401, aluno e monitor 403',
        async (url) => {
            expect((await get(url)).status).toBe(401);
            expect((await get(url, gerarToken({ id: 1, tipo: 'aluno' }))).status).toBe(403);
            const r = await get(url, gerarToken({ id: 2, tipo: 'monitor' }));
            expect(r.status).toBe(403);
            expect(r.body.erro).toBe('Acesso permitido apenas à coordenação.');
        }
    );

    it('coordenação vê o resumo, sem cache', async () => {
        const r = await get('/admin/resumo?periodo=2026.1', coord);
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ success: true, periodo: '2026.1' });
        expect(r.headers['cache-control']).toBe('no-store');
    });

    it('semestre em formato errado: 400', async () => {
        for (const url of ['/admin/resumo?periodo=2026-2', '/admin/monitores?periodo=26.1']) {
            const r = await get(url, coord);
            expect(r.status).toBe(400);
            expect(r.body.campos.periodo).toMatch(/AAAA\.1 ou AAAA\.2/);
        }
    });

    it('monitores e auditoria respondem para a coordenação', async () => {
        expect((await get('/admin/monitores', coord)).body).toEqual({
            success: true,
            monitores: []
        });
        expect((await get('/admin/auditoria?limit=500', coord)).body.registros).toEqual([]);
        expect(repo.listarAuditoria).toHaveBeenLastCalledWith(100);
        await get('/admin/auditoria?limit=abc', coord);
        expect(repo.listarAuditoria).toHaveBeenLastCalledWith(20);
    });
});

describe('Coordenação no login e fora do cadastro (RN-014)', () => {
    const base = {
        nome_completo: 'Fulana',
        email: 'f@exemplo.invalid',
        matricula: 123,
        senha: 'senhaForte1'
    };

    it('o cadastro público não aceita coordenador', () => {
        expect(cadastroSchema.safeParse({ ...base, tipo_usuario: 'coordenador' }).success).toBe(
            false
        );
    });

    it('login e pedido de nova senha aceitam coordenador', () => {
        expect(
            loginSchema.safeParse({
                identificador: 'f@exemplo.invalid',
                senha: 'x',
                tipo_usuario: 'coordenador'
            }).success
        ).toBe(true);
        expect(
            esqueciSenhaSchema.safeParse({
                email: 'f@exemplo.invalid',
                tipo_usuario: 'coordenador'
            }).success
        ).toBe(true);
        expect(
            loginSchema.safeParse({ identificador: 'x', senha: 'x', tipo_usuario: 'admin' }).success
        ).toBe(false);
    });

    it('POST /auth/cadastro com coordenador: 400', async () => {
        const r = await request(app)
            .post('/auth/cadastro')
            .send({ ...base, tipo_usuario: 'coordenador' });
        expect(r.status).toBe(400);
    });
});

describe('scripts/criar-coordenador.js', () => {
    const ARGS = [
        '--nome',
        'Profa. Helena',
        '--email',
        'Coord@Exemplo.invalid',
        '--matricula',
        '1001'
    ];
    let log;
    let erro;
    beforeEach(() => {
        log = jest.spyOn(console, 'log').mockImplementation(() => {});
        erro = jest.spyOn(console, 'error').mockImplementation(() => {});
        process.exitCode = undefined;
    });
    afterEach(() => {
        log.mockRestore();
        erro.mockRestore();
        process.exitCode = undefined;
    });

    /** Banco falso com o mínimo que o script usa. */
    function bancoFalso({ existe = false, coordenador = null } = {}) {
        const tx = {
            usuario: { create: jest.fn().mockResolvedValue({ id: 77 }) },
            auditoria: { create: jest.fn().mockResolvedValue({}) }
        };
        return {
            tx,
            usuario: {
                findFirst: jest.fn().mockResolvedValue(existe ? { id: 1 } : coordenador),
                update: jest.fn().mockResolvedValue({})
            },
            $transaction: jest.fn((fn) => fn(tx))
        };
    }
    const saida = () => log.mock.calls.map((c) => c.join(' ')).join('\n');

    it('lê os argumentos e normaliza o e-mail', () => {
        expect(script.lerArgumentos([...ARGS, '--aplicar'])).toEqual({
            modo: 'criar',
            nome_completo: 'Profa. Helena',
            email: 'coord@exemplo.invalid',
            matricula: 1001,
            aplicar: true
        });
        expect(script.lerArgumentos(['--email', 'A@B.invalid', '--nova-senha'])).toEqual({
            modo: 'senha',
            email: 'a@b.invalid',
            aplicar: false
        });
    });

    it('faltando dado ou com dado inválido, mostra o uso', () => {
        expect(script.lerArgumentos(['--nome', 'X']).erro).toMatch(/uso:/);
        expect(script.lerArgumentos(['--nova-senha']).erro).toMatch(/uso:/);
        expect(script.lerArgumentos([...ARGS.slice(0, 4), '--matricula', 'abc']).erro).toMatch(
            /matrícula/
        );
    });

    it('senha provisória com 16 caracteres, letra e número, sem caracteres ambíguos', () => {
        for (let i = 0; i < 20; i++) {
            const s = script.gerarSenhaProvisoria();
            expect(s).toHaveLength(16);
            expect(s).toMatch(/\p{L}/u);
            expect(s).toMatch(/\d/);
            expect(s).not.toMatch(/[01lIO]/);
        }
    });

    it('sem --aplicar só simula', async () => {
        const db = bancoFalso();
        await script.main(ARGS, db);
        expect(db.$transaction).not.toHaveBeenCalled();
        expect(saida()).toMatch(/simulação/);
    });

    it('com --aplicar cria a conta já confirmada e grava a auditoria', async () => {
        const db = bancoFalso();
        await script.main([...ARGS, '--aplicar'], db);
        const dados = db.tx.usuario.create.mock.calls[0][0].data;
        expect(dados).toMatchObject({
            tipo_usuario: 'coordenador',
            email: 'coord@exemplo.invalid'
        });
        expect(dados.email_confirmado_em).toBeInstanceOf(Date);
        expect(dados.senha).toMatch(/^\$2[aby]\$/);
        expect(db.tx.auditoria.create.mock.calls[0][0].data).toMatchObject({
            id_usuario: 77,
            acao: 'criar_coordenador',
            alvo: 'usuario:77'
        });
        expect(saida()).toMatch(/senha provisória/);
    });

    it('e-mail ou matrícula já usados por outra coordenação: erro', async () => {
        const db = bancoFalso({ existe: true });
        await script.main([...ARGS, '--aplicar'], db);
        expect(db.$transaction).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
    });

    it('nova senha: troca e encerra as sessões abertas', async () => {
        const db = bancoFalso({ coordenador: { id: 9, nome_completo: 'Helena' } });
        await script.main(['--email', 'c@x.invalid', '--nova-senha'], db);
        expect(db.usuario.update).not.toHaveBeenCalled();
        await script.main(['--email', 'c@x.invalid', '--nova-senha', '--aplicar'], db);
        expect(db.usuario.update.mock.calls[0][0].data.versao_token).toEqual({ increment: 1 });
    });

    it('nova senha para quem não é coordenação: erro', async () => {
        await script.main(['--email', 'c@x.invalid', '--nova-senha', '--aplicar'], bancoFalso());
        expect(process.exitCode).toBe(1);
    });

    it('argumentos inválidos: código 2', async () => {
        await script.main([], bancoFalso());
        expect(process.exitCode).toBe(2);
    });
});
