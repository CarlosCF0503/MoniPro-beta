// Só a conta de aluno se inscreve, e nunca na vaga em que a mesma pessoa é o monitor. Sem isso,
// o monitor se inscrevia na própria vaga, confirmava a presença dos dois lados e somava pontos,
// ranking e horas de certificado sozinho. O SQL que reconhece a mesma pessoa (mesma conta,
// matrícula ou e-mail) é testado contra o Postgres em
// tests/integracao/inscricaoPropriaVaga.int.test.js.
jest.mock('../src/repositories/agendamentoRepository');
jest.mock('../src/services/notificacaoService');

const request = require('supertest');
const { gerarToken } = require('./helpers/token');
const repo = require('../src/repositories/agendamentoRepository');
const agendamentoService = require('../src/services/agendamentoService');
const listaEsperaService = require('../src/services/listaEsperaService');
const app = require('../src/app');

const HORA = 60 * 60 * 1000;
const vaga = (extra = {}) => ({
    id: 5,
    capacidade: 2,
    status: 'ativa',
    status_disciplina: 'aprovada',
    id_monitor: 30,
    mesma_pessoa: false,
    horario: new Date(Date.now() + 3 * 24 * HORA),
    ...extra
});
const tx = { tx: true };
const com = (req, token) => req.set('Cookie', `monipro_sessao=${token}`);

beforeEach(() => {
    jest.clearAllMocks();
    repo.emTransacao.mockImplementation((fn) => fn(tx));
    repo.buscarPorAlunoEMonitoria.mockResolvedValue(null);
    repo.contarOcupadas.mockResolvedValue(0);
    repo.contarFila.mockResolvedValue(0);
    repo.criar.mockImplementation(async (dados) => ({ id: 99, ...dados }));
    repo.datasDeAusencia.mockResolvedValue([]);
});

describe('quem pode se inscrever', () => {
    it.each(['monitor', 'coordenador'])(
        '%s: 403 na inscrição e na lista de espera, sem tocar na vaga',
        async (tipo) => {
            const token = gerarToken({ id: 30, tipo });

            const inscricao = await com(request(app).post('/agendamentos'), token).send({
                id_monitoria: 5
            });
            const fila = await com(request(app).post('/monitorias/5/espera'), token);

            expect(inscricao.status).toBe(403);
            expect(inscricao.body.erro).toMatch(/Só alunos/);
            expect(fila.status).toBe(403);
            expect(repo.bloquearMonitoria).not.toHaveBeenCalled();
            expect(repo.criar).not.toHaveBeenCalled();
        }
    );

    it('aluno: a inscrição segue normal e a trava recebe o id do aluno', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga());

        const r = await com(
            request(app).post('/agendamentos'),
            gerarToken({ id: 20, tipo: 'aluno' })
        ).send({ id_monitoria: 5 });

        expect(r.status).toBe(201);
        expect(repo.bloquearMonitoria).toHaveBeenCalledWith(5, tx, 20);
    });
});

describe('o monitor não se inscreve na própria vaga, nem pela conta de aluno dele', () => {
    it('inscrição: 403 e nada é gravado', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga({ mesma_pessoa: true }));

        await expect(
            agendamentoService.criar({ id_monitoria: 5, id_aluno: 20 })
        ).rejects.toMatchObject({
            statusCode: 403,
            message: expect.stringMatching(/monitor desta vaga/)
        });
        expect(repo.criar).not.toHaveBeenCalled();
        expect(repo.promover).not.toHaveBeenCalled();
    });

    it('lista de espera: 403 e nada é gravado', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga({ mesma_pessoa: true }));
        repo.contarOcupadas.mockResolvedValue(2);

        await expect(listaEsperaService.entrar(5, 20)).rejects.toMatchObject({ statusCode: 403 });
        expect(repo.bloquearMonitoria).toHaveBeenCalledWith(5, tx, 20);
        expect(repo.criar).not.toHaveBeenCalled();
    });
});

describe('inscrição antiga do monitor na própria vaga', () => {
    it('confirmar a presença não conclui nem credita pontos', async () => {
        repo.bloquearParaPresenca.mockResolvedValue({
            id: 1,
            id_aluno: 30,
            id_monitor: 30,
            status: 'pendente',
            presenca_aluno_em: new Date(),
            presenca_monitor_em: null,
            horario: new Date(Date.now() - 2 * HORA),
            status_vaga: 'realizada'
        });

        await expect(agendamentoService.registrarPresenca(1, 'monitor', 30)).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringMatching(/própria vaga/)
        });
        expect(repo.registrarPresenca).not.toHaveBeenCalled();
    });
});
