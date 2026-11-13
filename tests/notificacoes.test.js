// Plano 3 (RF-010, RN-011): fila de avisos por e-mail (regras de envio, novas tentativas,
// lembretes e textos). O banco real fica com tests/integracao/notificacoes.int.test.js.
jest.mock('../src/repositories/notificacaoRepository');
jest.mock('../src/services/email', () => ({ enviar: jest.fn(), enviarSemEsperar: jest.fn() }));

const repo = require('../src/repositories/notificacaoRepository');
const email = require('../src/services/email');
const notificacaoService = require('../src/services/notificacaoService');
const { montar } = require('../src/services/email/modelos');
const { intervaloNotificacoesMs } = require('../src/config/notificacoes');

const AGORA = new Date('2026-11-12T12:00:00.000Z');
const MIN = 60 * 1000;
const vaga = {
    id: 5,
    horario: new Date('2026-11-13T18:00:00.000Z'),
    local: 'Bloco C, sala 7',
    descricao: 'Limites',
    id_disciplina: 2,
    disciplina: { nome: 'Cálculo I' },
    monitor: { nome_completo: 'Ana Ribeiro' }
};
const aviso = (extra = {}) => ({
    id: 1,
    id_usuario: 4,
    modelo: 'inscricao',
    dados: { disciplina: 'Cálculo I' },
    tentativas: 0,
    ...extra
});

beforeEach(() => {
    jest.clearAllMocks();
    repo.buscarVaga.mockResolvedValue(vaga);
    repo.enfileirar.mockImplementation(async (lista) => lista.length);
    repo.buscarDestinatario.mockResolvedValue({
        email: 'diego@exemplo.edu.br',
        nome_completo: 'Diego Martins',
        anonimizado_em: null
    });
});

describe('Enfileirar avisos', () => {
    it('inscrição: um aviso para o aluno, com chave única por inscrição', async () => {
        await notificacaoService.avisarInscricao(
            { idAgendamento: 108, idAluno: 4, idMonitoria: 5 },
            'tx'
        );

        const [lista, db] = repo.enfileirar.mock.calls[0];
        expect(db).toBe('tx');
        expect(lista).toEqual([
            {
                id_usuario: 4,
                modelo: 'inscricao',
                chave: 'inscricao:agendamento:108',
                dados: {
                    disciplina: 'Cálculo I',
                    id_disciplina: 2,
                    monitor: 'Ana Ribeiro',
                    horario: '2026-11-13T18:00:00.000Z',
                    local: 'Bloco C, sala 7',
                    assunto: 'Limites'
                }
            }
        ]);
    });

    it('vaga cancelada com 3 inscritos: 3 avisos', async () => {
        repo.buscarInscritosAtivos.mockResolvedValue([
            { id: 1, id_aluno: 11 },
            { id: 2, id_aluno: 12 },
            { id: 3, id_aluno: 13 }
        ]);

        await notificacaoService.avisarCancelamento(5, 'tx');

        const lista = repo.enfileirar.mock.calls[0][0];
        expect(lista.map((a) => a.id_usuario)).toEqual([11, 12, 13]);
        expect(new Set(lista.map((a) => a.chave)).size).toBe(3);
        expect(lista.every((a) => a.modelo === 'vaga-cancelada')).toBe(true);
    });

    it('vaga alterada: leva só o que mudou como "anterior"', async () => {
        repo.buscarInscritosAtivos.mockResolvedValue([{ id: 1, id_aluno: 11 }]);

        await notificacaoService.avisarAlteracao(
            5,
            { horario: vaga.horario, local: 'Biblioteca' },
            AGORA,
            'tx'
        );

        const [{ dados, modelo }] = repo.enfileirar.mock.calls[0][0];
        expect(modelo).toBe('vaga-alterada');
        expect(dados.local_anterior).toBe('Biblioteca');
        expect(dados).not.toHaveProperty('horario_anterior');
    });

    it('lembrete: procura sessões entre 20h e 24h e a chave leva o horário', async () => {
        repo.buscarSessoesParaLembrete.mockResolvedValue([
            { id: 108, id_aluno: 4, id_monitoria: 5, data_hora: vaga.horario }
        ]);

        await notificacaoService.enfileirarLembretes(AGORA);

        const [de, ate] = repo.buscarSessoesParaLembrete.mock.calls[0];
        expect(de).toEqual(new Date('2026-11-13T08:00:00.000Z'));
        expect(ate).toEqual(new Date('2026-11-13T12:00:00.000Z'));
        expect(repo.enfileirar.mock.calls[0][0][0].chave).toBe(
            'lembrete:agendamento:108:2026-11-13T18:00:00.000Z'
        );
    });
});

describe('Processar a fila', () => {
    it('envia com o nome atual do aluno e marca como enviada', async () => {
        repo.reservarLote.mockResolvedValue([aviso()]);

        const r = await notificacaoService.processarFila(AGORA);

        expect(r).toEqual({ enviadas: 1, falhas: 0 });
        expect(email.enviar).toHaveBeenCalledWith({
            para: 'diego@exemplo.edu.br',
            modelo: 'inscricao',
            dados: { disciplina: 'Cálculo I', nome: 'Diego Martins' }
        });
        expect(repo.marcarEnviada).toHaveBeenCalledWith(1, expect.any(Date));
        // Reserva o lote por 5 minutos, até 50 avisos
        expect(repo.reservarLote).toHaveBeenCalledWith(
            AGORA,
            new Date(AGORA.getTime() + 5 * MIN),
            50
        );
    });

    it.each([
        [0, 1],
        [1, 5],
        [2, 15],
        [3, 60]
    ])('falha com %i tentativas antes: tenta de novo em %i min', async (antes, minutos) => {
        repo.reservarLote.mockResolvedValue([aviso({ tentativas: antes })]);
        email.enviar.mockRejectedValue(new Error('provedor fora do ar'));

        const r = await notificacaoService.processarFila(AGORA);

        expect(r).toEqual({ enviadas: 0, falhas: 1 });
        expect(repo.registrarFalha).toHaveBeenCalledWith(1, {
            tentativas: antes + 1,
            proximaTentativa: new Date(AGORA.getTime() + minutos * MIN),
            erro: 'provedor fora do ar',
            desistir: false
        });
    });

    it('na 5ª falha desiste e marca "falhou"', async () => {
        repo.reservarLote.mockResolvedValue([aviso({ tentativas: 4 })]);
        email.enviar.mockRejectedValue(new Error('caixa inexistente'));

        await notificacaoService.processarFila(AGORA);

        expect(repo.registrarFalha.mock.calls[0][1]).toMatchObject({
            tentativas: 5,
            desistir: true
        });
    });

    it('conta removida (LGPD) não recebe e o aviso é descartado', async () => {
        repo.reservarLote.mockResolvedValue([aviso()]);
        repo.buscarDestinatario.mockResolvedValue({
            email: 'removido-4@anonimo.invalid',
            anonimizado_em: new Date()
        });

        await notificacaoService.processarFila(AGORA);

        expect(email.enviar).not.toHaveBeenCalled();
        expect(repo.registrarFalha.mock.calls[0][1]).toMatchObject({ desistir: true });
    });

    it('uma falha não impede o resto do lote', async () => {
        repo.reservarLote.mockResolvedValue([aviso({ id: 1 }), aviso({ id: 2 })]);
        email.enviar.mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce();

        expect(await notificacaoService.processarFila(AGORA)).toEqual({ enviadas: 1, falhas: 1 });
        expect(repo.marcarEnviada).toHaveBeenCalledWith(2, expect.any(Date));
    });
});

describe('Temporizador', () => {
    it('intervalo padrão de 60 s; 0 desliga; valor inválido volta ao padrão', () => {
        expect(intervaloNotificacoesMs({})).toBe(60000);
        expect(intervaloNotificacoesMs({ NOTIFICACOES_INTERVALO_SEGUNDOS: '0' })).toBe(0);
        expect(intervaloNotificacoesMs({ NOTIFICACOES_INTERVALO_SEGUNDOS: '15' })).toBe(15000);
        expect(intervaloNotificacoesMs({ NOTIFICACOES_INTERVALO_SEGUNDOS: 'x' })).toBe(60000);
    });

    it('não começa uma rodada antes da anterior terminar', async () => {
        jest.useFakeTimers();
        let liberar;
        repo.buscarSessoesParaLembrete.mockResolvedValue([]);
        repo.reservarLote.mockImplementation(
            () =>
                new Promise((r) => {
                    liberar = () => r([]);
                })
        );
        const parar = notificacaoService.iniciar(1000);

        await jest.advanceTimersByTimeAsync(3500);
        expect(repo.reservarLote).toHaveBeenCalledTimes(1);
        liberar();
        await jest.advanceTimersByTimeAsync(1000);
        expect(repo.reservarLote).toHaveBeenCalledTimes(2);

        parar();
        jest.useRealTimers();
    });
});

describe('Modelos dos avisos', () => {
    const d = {
        nome: 'Diego Martins',
        disciplina: 'Cálculo I',
        monitor: 'Ana Ribeiro',
        horario: '2026-11-13T18:00:00.000Z',
        local: 'Bloco C, sala 7'
    };

    it('inscrição: horário no fuso do campus e prazo de cancelamento de 24h', () => {
        const m = montar('inscricao', d);
        expect(m.assunto).toBe('Inscrição confirmada: Cálculo I, sex 13/11 às 15:00');
        expect(m.texto).toContain('Quando: sexta, 13/11, às 15:00');
        expect(m.texto).toContain('Você pode cancelar até quinta, 12/11, às 15:00');
        expect(m.texto).toContain('/perfil_aluno.html');
    });

    it('vaga alterada: mostra antes → depois só do que mudou', () => {
        const m = montar('vaga-alterada', {
            ...d,
            horario_anterior: '2026-11-13T15:00:00.000Z'
        });
        expect(m.assunto).toBe('Mudou o horário da monitoria de Cálculo I');
        expect(m.texto).toContain('Quando: sexta, 13/11, às 12:00 → sexta, 13/11, às 15:00');
        expect(m.texto).toContain('Local: Bloco C, sala 7\n');
    });

    it('vaga cancelada aponta para outros horários; lembrete fala de amanhã', () => {
        expect(montar('vaga-cancelada', d).assunto).toBe(
            'Cancelada: monitoria de Cálculo I, sex 13/11'
        );
        expect(montar('vaga-cancelada', d).texto).toContain('/marcar_monitoria.html');
        expect(montar('lembrete', d).assunto).toBe('Amanhã às 15:00: monitoria de Cálculo I');
    });

    it('texto digitado pelo monitor é escapado no HTML', () => {
        const m = montar('inscricao', { ...d, local: '<img src=x onerror=alert(1)>' });
        expect(m.html).not.toContain('<img src=x');
        expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
});
