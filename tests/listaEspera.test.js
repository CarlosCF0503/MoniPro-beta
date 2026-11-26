// Plano 8 (RF-013, RN-015): lista de espera das vagas lotadas.
jest.mock('../src/repositories/agendamentoRepository');
jest.mock('../src/services/notificacaoService');

const request = require('supertest');
const { gerarToken } = require('./helpers/token');
const repo = require('../src/repositories/agendamentoRepository');
const notificacaoService = require('../src/services/notificacaoService');
const listaEsperaService = require('../src/services/listaEsperaService');
const app = require('../src/app');

const HORA = 60 * 60 * 1000;
const AGORA = new Date('2026-11-18T12:00:00.000Z');
const vaga = (extra = {}) => ({
    id: 5,
    capacidade: 2,
    status: 'ativa',
    horario: new Date(AGORA.getTime() + 3 * 24 * HORA),
    ...extra
});
const tx = { tx: true };

beforeEach(() => {
    jest.clearAllMocks();
    repo.emTransacao.mockImplementation((fn) => fn(tx));
    repo.buscarPorAlunoEMonitoria.mockResolvedValue(null);
    repo.criar.mockImplementation(async (dados) => ({ id: 99, ...dados }));
    repo.datasDeAusencia.mockResolvedValue([]); // plano 12: sem faltas
});

describe('entrar na lista de espera', () => {
    it('vaga lotada: entra em espera, sem ocupar lugar, e recebe a posição', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga());
        repo.contarOcupadas.mockResolvedValue(2);
        repo.contarFila.mockResolvedValue(1);

        const r = await listaEsperaService.entrar(5, 20, AGORA);

        expect(r.posicao).toBe(2);
        expect(repo.criar).toHaveBeenCalledWith(
            { id_monitoria: 5, id_aluno: 20, status: 'em_espera', data_hora: vaga().horario },
            tx
        );
        expect(notificacaoService.avisarInscricao).not.toHaveBeenCalled();
    });

    it('vaga com lugar livre: 422 (a inscrição é a normal)', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga());
        repo.contarOcupadas.mockResolvedValue(1);

        await expect(listaEsperaService.entrar(5, 20, AGORA)).rejects.toMatchObject({
            statusCode: 422
        });
        expect(repo.criar).not.toHaveBeenCalled();
    });

    it('fila cheia (tantos quanto os lugares): 409', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga());
        repo.contarOcupadas.mockResolvedValue(2);
        repo.contarFila.mockResolvedValue(2);

        await expect(listaEsperaService.entrar(5, 20, AGORA)).rejects.toThrow(/está cheia/);
    });

    it('já inscrito ou já na fila: 409 com a mensagem certa', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga());
        repo.buscarPorAlunoEMonitoria.mockResolvedValue({ id: 3, status: 'em_espera' });
        await expect(listaEsperaService.entrar(5, 20, AGORA)).rejects.toThrow(
            /já está na lista de espera/
        );

        repo.buscarPorAlunoEMonitoria.mockResolvedValue({ id: 3, status: 'pendente' });
        await expect(listaEsperaService.entrar(5, 20, AGORA)).rejects.toThrow(/já está inscrito/);
    });

    it('a fila fecha 2h antes do início; vaga cancelada ou inexistente não aceita', async () => {
        repo.bloquearMonitoria.mockResolvedValue(
            vaga({ horario: new Date(AGORA.getTime() + 119 * 60 * 1000) })
        );
        await expect(listaEsperaService.entrar(5, 20, AGORA)).rejects.toThrow(/fecha 2h antes/);

        repo.bloquearMonitoria.mockResolvedValue(vaga({ status: 'cancelada' }));
        await expect(listaEsperaService.entrar(5, 20, AGORA)).rejects.toThrow(/não está aberta/);

        repo.bloquearMonitoria.mockResolvedValue(null);
        await expect(listaEsperaService.entrar(5, 20, AGORA)).rejects.toMatchObject({
            statusCode: 404
        });
        await expect(listaEsperaService.entrar(NaN, 20, AGORA)).rejects.toMatchObject({
            statusCode: 404
        });
    });
});

describe('promover da fila', () => {
    it('preenche só os lugares livres, na ordem da fila, e avisa cada promovido', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga({ capacidade: 3 }));
        repo.contarOcupadas.mockResolvedValue(1);
        repo.primeirosDaFila.mockResolvedValue([
            { id: 11, id_aluno: 31 },
            { id: 12, id_aluno: 32 }
        ]);

        const promovidos = await listaEsperaService.promover(5, tx, AGORA);

        expect(promovidos).toHaveLength(2);
        expect(repo.primeirosDaFila).toHaveBeenCalledWith(5, 2, tx);
        expect(repo.promover).toHaveBeenCalledWith(11, AGORA, false, tx);
        expect(repo.promover).toHaveBeenCalledWith(12, AGORA, false, tx);
        expect(notificacaoService.avisarPromocao).toHaveBeenCalledWith(
            { idAgendamento: 11, idAluno: 31, idMonitoria: 5, podeCancelarAteOInicio: false },
            tx
        );
    });

    it('com menos de 24h para o início, o promovido pode cancelar até o horário', async () => {
        repo.bloquearMonitoria.mockResolvedValue(
            vaga({ horario: new Date(AGORA.getTime() + 5 * HORA) })
        );
        repo.contarOcupadas.mockResolvedValue(1);
        repo.primeirosDaFila.mockResolvedValue([{ id: 11, id_aluno: 31 }]);

        await listaEsperaService.promover(5, tx, AGORA);

        expect(repo.promover).toHaveBeenCalledWith(11, AGORA, true, tx);
        expect(notificacaoService.avisarPromocao.mock.calls[0][0].podeCancelarAteOInicio).toBe(
            true
        );
    });

    it('com menos de 2h para o início, ninguém é promovido (RN-015)', async () => {
        repo.bloquearMonitoria.mockResolvedValue(
            vaga({ horario: new Date(AGORA.getTime() + 119 * 60 * 1000) })
        );

        expect(await listaEsperaService.promover(5, tx, AGORA)).toEqual([]);
        expect(repo.primeirosDaFila).not.toHaveBeenCalled();
    });

    it('vaga lotada, cancelada ou sem fila: nada muda', async () => {
        repo.bloquearMonitoria.mockResolvedValue(vaga());
        repo.contarOcupadas.mockResolvedValue(2);
        expect(await listaEsperaService.promover(5, tx, AGORA)).toEqual([]);

        repo.bloquearMonitoria.mockResolvedValue(vaga({ status: 'cancelada' }));
        expect(await listaEsperaService.promover(5, tx, AGORA)).toEqual([]);

        repo.bloquearMonitoria.mockResolvedValue(vaga());
        repo.contarOcupadas.mockResolvedValue(0);
        repo.primeirosDaFila.mockResolvedValue([]);
        expect(await listaEsperaService.promover(5, tx, AGORA)).toEqual([]);
        expect(repo.promover).not.toHaveBeenCalled();
    });
});

describe('rotas', () => {
    const tokenAluno = gerarToken({ id: 20, tipo: 'aluno' });
    const cookie = `monipro_sessao=${tokenAluno}`;

    it('POST /monitorias/:id/espera: 201 com a posição', async () => {
        repo.bloquearMonitoria.mockResolvedValue(
            vaga({ horario: new Date(Date.now() + 3 * 24 * HORA) })
        );
        repo.contarOcupadas.mockResolvedValue(2);
        repo.contarFila.mockResolvedValue(0);

        const r = await request(app).post('/monitorias/5/espera').set('Cookie', cookie);

        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ success: true, posicao: 1 });
        expect(r.body.mensagem).toMatch(/posição: 1º/);
    });

    it('POST /monitorias/:id/espera sem login: 401', async () => {
        expect((await request(app).post('/monitorias/5/espera')).status).toBe(401);
    });

    it('DELETE /agendamentos/:id de quem está na fila: sai a qualquer hora e ninguém é promovido', async () => {
        repo.buscarPorId.mockResolvedValue({
            id: 3,
            id_aluno: 20,
            id_monitoria: 5,
            status: 'em_espera',
            data_hora: new Date(Date.now() + HORA) // menos de 24h: a fila não segue a RN-001
        });

        const r = await request(app).delete('/agendamentos/3').set('Cookie', cookie);

        expect(r.status).toBe(200);
        expect(r.body.mensagem).toBe('Você saiu da lista de espera.');
        expect(repo.deletar).toHaveBeenCalledWith(3, tx);
        expect(repo.primeirosDaFila).not.toHaveBeenCalled();
    });

    it('DELETE /agendamentos/:id de um inscrito: o lugar vai para o primeiro da fila', async () => {
        repo.buscarPorId.mockResolvedValue({
            id: 3,
            id_aluno: 20,
            id_monitoria: 5,
            status: 'pendente',
            data_hora: new Date(Date.now() + 3 * 24 * HORA)
        });
        repo.bloquearMonitoria.mockResolvedValue(
            vaga({ horario: new Date(Date.now() + 3 * 24 * HORA) })
        );
        repo.contarOcupadas.mockResolvedValue(1);
        repo.primeirosDaFila.mockResolvedValue([{ id: 11, id_aluno: 31 }]);

        const r = await request(app).delete('/agendamentos/3').set('Cookie', cookie);

        expect(r.status).toBe(200);
        expect(repo.deletar).toHaveBeenCalledWith(3, tx);
        expect(repo.promover).toHaveBeenCalledWith(11, expect.any(Date), false, tx);
    });
});
