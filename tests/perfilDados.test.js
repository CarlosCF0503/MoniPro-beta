// Funções puras do perfil do monitor (Monipro_web/JS/perfil/dados.js)
const D = require('../Monipro_web/JS/perfil/dados.js');

const AGORA = new Date(2026, 10, 7, 12, 0);

function vaga(campos) {
    return D.normalizar({
        id: 1,
        horario: new Date(2026, 10, 10, 14, 0).toISOString(),
        local: 'Sala 204',
        status: 'ativa',
        capacidade: 3,
        disciplina: { nome: 'Cálculo I' },
        ...campos
    });
}

describe('perfil do monitor — dados', () => {
    test('normalizar converte datas e mantém inscritos nulo quando a API não manda', () => {
        const v = vaga({ data_fim: new Date(2026, 10, 10, 15, 30).toISOString() });
        expect(v.inicio).toEqual(new Date(2026, 10, 10, 14, 0));
        expect(v.fim).toEqual(new Date(2026, 10, 10, 15, 30));
        expect(v.inscritos).toBeNull();
        expect(vaga({ inscritos: 2 }).inscritos).toBe(2);
        expect(vaga({ disciplina: null }).disciplina).toBe('Disciplina');
    });

    test('vaga ativa que já começou vai para "Para finalizar"; futura, para "Próximas"', () => {
        expect(D.grupo(vaga({ horario: new Date(2026, 10, 5, 14).toISOString() }), AGORA)).toBe(
            'finalizar'
        );
        expect(D.grupo(vaga({ status: 'pendente' }), AGORA)).toBe('proximas');
        expect(D.grupo(vaga({ status: 'realizada' }), AGORA)).toBe('historico');
        expect(D.grupo(vaga({ status: 'cancelada' }), AGORA)).toBe('historico');
    });

    test('separar ordena próximas da mais perto e histórico da mais recente', () => {
        const l = D.separar(
            [
                vaga({ id: 1, horario: new Date(2026, 10, 14, 19).toISOString() }),
                vaga({ id: 2, horario: new Date(2026, 10, 10, 14).toISOString() }),
                vaga({
                    id: 3,
                    status: 'realizada',
                    horario: new Date(2026, 9, 15, 14).toISOString()
                }),
                vaga({
                    id: 4,
                    status: 'cancelada',
                    horario: new Date(2026, 9, 24, 10).toISOString()
                })
            ],
            AGORA
        );
        expect(l.proximas.map((v) => v.id)).toEqual([2, 1]);
        expect(l.historico.map((v) => v.id)).toEqual([4, 3]);
        expect(l.finalizar).toEqual([]);
    });

    test('horas comprovadas somam só as finalizadas com término', () => {
        const vagas = [
            vaga({
                status: 'realizada',
                horario: new Date(2026, 9, 29, 14).toISOString(),
                data_fim: new Date(2026, 9, 29, 15, 30).toISOString()
            }),
            vaga({
                status: 'concluida',
                disciplina: { nome: 'Física I' },
                horario: new Date(2026, 9, 22, 19).toISOString(),
                data_fim: new Date(2026, 9, 22, 20).toISOString()
            }),
            vaga({ status: 'cancelada', data_fim: new Date(2026, 10, 10, 18).toISOString() }),
            vaga({ status: 'realizada' }) // sem data_fim: não conta
        ];
        expect(D.minutosComprovados(vagas)).toBe(150);
        expect(D.horasPorDisciplina(vagas)).toEqual([
            { disciplina: 'Cálculo I', minutos: 90 },
            { disciplina: 'Física I', minutos: 60 }
        ]);
    });

    test('cancelar só com 24h ou mais até o início (RN-001)', () => {
        expect(
            D.podeCancelar(vaga({ horario: new Date(2026, 10, 8, 12).toISOString() }), AGORA)
        ).toBe(true);
        expect(
            D.podeCancelar(vaga({ horario: new Date(2026, 10, 8, 11).toISOString() }), AGORA)
        ).toBe(false);
        // já começou: só finalizar
        expect(
            D.podeCancelar(vaga({ horario: new Date(2026, 10, 5, 14).toISOString() }), AGORA)
        ).toBe(false);
        expect(D.podeCancelar(vaga({ status: 'cancelada' }), AGORA)).toBe(false);
    });

    test('opções de término vão de 15 em 15 minutos até 4h depois do início', () => {
        const ops = D.opcoesTermino(new Date(2026, 10, 5, 14, 0));
        expect(ops).toHaveLength(16);
        expect(ops[0]).toEqual({ minutos: 15, hora: '14:15' });
        expect(ops[3]).toEqual({ minutos: 60, hora: '15:00' });
        expect(ops[15]).toEqual({ minutos: 240, hora: '18:00' });
    });

    test('duração, iniciais e agrupamento por mês', () => {
        expect(D.duracao(90)).toBe('1h30');
        expect(D.duracao(60)).toBe('1h');
        expect(D.duracao(45)).toBe('45min');
        expect(D.iniciais('Ana Beatriz Souza')).toBe('AS');
        expect(D.iniciais('Bruno')).toBe('B');
        const grupos = D.agruparPorMes([
            vaga({ horario: new Date(2026, 10, 2, 14).toISOString() }),
            vaga({ horario: new Date(2026, 9, 29, 14).toISOString() }),
            vaga({ horario: new Date(2026, 9, 15, 14).toISOString() })
        ]);
        expect(grupos.map((g) => [g.rotulo, g.vagas.length])).toEqual([
            ['Novembro de 2026', 1],
            ['Outubro de 2026', 2]
        ]);
    });
});

describe('presença confirmada pelo aluno e pelo monitor (P2, D1)', () => {
    const passada = vaga({ horario: new Date(2026, 10, 5, 14).toISOString() });
    const inscricao = (status, id = 1, nome = 'Bia') => ({ id, idVaga: 1, aluno: nome, status });

    test('normalizarInscricao pega o nome do aluno e o status em minúsculas', () => {
        expect(
            D.normalizarInscricao({
                id: 9,
                id_monitoria: 4,
                status: 'PENDENTE',
                aluno: { nome_completo: 'Ana' }
            })
        ).toEqual({
            id: 9,
            idVaga: 4,
            aluno: 'Ana',
            status: 'pendente',
            alunoConfirmou: false,
            monitorConfirmou: false
        });
        const marcada = D.normalizarInscricao({ id: 2, presenca_aluno_em: '2026-11-06T15:00:00Z' });
        expect(marcada.alunoConfirmou).toBe(true);
        expect(marcada.monitorConfirmou).toBe(false);
        expect(D.normalizarInscricao({ id: 1, id_monitoria: 4 }).aluno).toBe('Aluno');
    });

    test('agruparInscricoes separa por vaga, ordena pelo nome e tira as canceladas', () => {
        const mapa = D.agruparInscricoes([
            { id: 1, idVaga: 4, aluno: 'Caio', status: 'pendente' },
            { id: 2, idVaga: 4, aluno: 'Ágata', status: 'concluido' },
            { id: 3, idVaga: 5, aluno: 'Bia', status: 'cancelado' }
        ]);
        expect(mapa.get(4).map((i) => i.aluno)).toEqual(['Ágata', 'Caio']);
        expect(mapa.has(5)).toBe(false);
    });

    test('só dá para confirmar depois do início e em até 7 dias', () => {
        const futura = vaga({});
        expect(D.situacaoPresenca(inscricao('pendente'), futura, AGORA)).toBe('antes');
        expect(D.situacaoPresenca(inscricao('pendente'), passada, AGORA)).toBe('confirmar');
        expect(D.situacaoPresenca(inscricao('confirmado'), passada, AGORA)).toBe('confirmar');
        const noLimite = new Date(2026, 10, 12, 14, 0);
        expect(D.situacaoPresenca(inscricao('pendente'), passada, noLimite)).toBe('confirmar');
        const depois = new Date(2026, 10, 12, 14, 1);
        expect(D.situacaoPresenca(inscricao('pendente'), passada, depois)).toBe('expirada');
        expect(D.limiteConfirmacao(passada)).toEqual(noLimite);
    });

    test('presença confirmada e vaga cancelada não oferecem o botão', () => {
        expect(D.situacaoPresenca(inscricao('concluido'), passada, AGORA)).toBe('confirmada');
        const cancelada = vaga({ horario: passada.inicio.toISOString(), status: 'cancelada' });
        expect(D.situacaoPresenca(inscricao('pendente'), cancelada, AGORA)).toBe('cancelada');
    });

    test('quem já confirmou fica aguardando o outro lado', () => {
        const doAluno = { ...inscricao('pendente'), alunoConfirmou: true };
        expect(D.situacaoPresenca(doAluno, passada, AGORA, 'aluno')).toBe('aguardando');
        expect(D.situacaoPresenca(doAluno, passada, AGORA, 'monitor')).toBe('confirmar');
        const doMonitor = { ...inscricao('pendente'), monitorConfirmou: true };
        expect(D.situacaoPresenca(doMonitor, passada, AGORA, 'monitor')).toBe('aguardando');
        expect(D.situacaoPresenca(doMonitor, passada, AGORA, 'aluno')).toBe('confirmar');
        // Depois do prazo, uma confirmação só de um lado não vale mais
        expect(D.situacaoPresenca(doAluno, passada, new Date(2026, 10, 13), 'aluno')).toBe(
            'expirada'
        );
    });

    test('presencasAConfirmar conta só as que o monitor ainda pode confirmar', () => {
        const lista = [
            inscricao('pendente', 1),
            inscricao('concluido', 2),
            inscricao('pendente', 3),
            { ...inscricao('pendente', 4), monitorConfirmou: true }
        ];
        expect(D.presencasAConfirmar(lista, passada, AGORA)).toBe(2);
        expect(D.presencasAConfirmar(lista, vaga({}), AGORA)).toBe(0);
        expect(D.presencasAConfirmar(undefined, passada, AGORA)).toBe(0);
    });
});

describe('perfil do aluno — inscrições (P2)', () => {
    const insc = (campos) =>
        D.normalizarMinhaInscricao({
            id: 1,
            status: 'pendente',
            presenca_aluno_em: null,
            presenca_monitor_em: null,
            ...campos,
            monitoria: {
                horario: new Date(2026, 10, 5, 14).toISOString(),
                local: 'Sala 204',
                status: 'realizada',
                disciplina: { nome: 'Cálculo I' },
                monitor: { nome_completo: 'Ana Ribeiro' },
                ...(campos.monitoria || {})
            }
        });

    test('normalizarMinhaInscricao junta inscrição e vaga', () => {
        const i = insc({ presenca_monitor_em: '2026-11-05T18:00:00Z' });
        expect(i).toMatchObject({
            disciplina: 'Cálculo I',
            monitor: 'Ana Ribeiro',
            local: 'Sala 204',
            statusVaga: 'realizada',
            alunoConfirmou: false,
            monitorConfirmou: true
        });
        expect(i.inicio).toEqual(new Date(2026, 10, 5, 14));
        expect(
            D.normalizarMinhaInscricao({ id: 2, data_hora: '2026-11-05T14:00:00Z' }).disciplina
        ).toBe('Disciplina');
    });

    test('separarInscricoes: para confirmar, próximas e histórico, cada uma na sua ordem', () => {
        const lista = [
            insc({ id: 1 }), // 05/11, ninguém confirmou -> confirmar
            insc({ id: 2, monitoria: { horario: new Date(2026, 10, 6, 9).toISOString() } }), // confirmar
            insc({
                id: 3,
                monitoria: { horario: new Date(2026, 10, 10, 9).toISOString(), status: 'ativa' }
            }), // próxima
            insc({
                id: 4,
                monitoria: { horario: new Date(2026, 10, 9, 9).toISOString(), status: 'ativa' }
            }), // próxima
            insc({ id: 5, status: 'concluido' }), // histórico
            insc({ id: 6, presenca_aluno_em: '2026-11-05T18:00:00Z' }), // aguardando -> histórico
            insc({
                id: 7,
                monitoria: { horario: new Date(2026, 10, 10, 9).toISOString(), status: 'cancelada' }
            }) // vaga cancelada
        ];
        const L = D.separarInscricoes(lista, AGORA);
        expect(L.confirmar.map((i) => i.id)).toEqual([1, 2]);
        expect(L.proximas.map((i) => i.id)).toEqual([4, 3]);
        expect(L.historico.map((i) => i.id).sort()).toEqual([5, 6, 7]);
        expect(D.situacaoDoAluno(lista[5], AGORA)).toBe('aguardando');
    });

    test('podeCancelarInscricao segue a RN-001 (24h antes) e recusa vaga cancelada', () => {
        const futura = (horas, status = 'ativa') =>
            insc({
                monitoria: {
                    horario: new Date(AGORA.getTime() + horas * 3600e3).toISOString(),
                    status
                }
            });
        expect(D.podeCancelarInscricao(futura(48), AGORA)).toBe(true);
        expect(D.podeCancelarInscricao(futura(23), AGORA)).toBe(false);
        expect(D.podeCancelarInscricao(futura(48, 'cancelada'), AGORA)).toBe(false);
    });

    test('presencasPorDisciplina conta só as confirmadas pelos dois', () => {
        const lista = [
            insc({ status: 'concluido' }),
            insc({ status: 'concluido' }),
            insc({ status: 'concluido', monitoria: { disciplina: { nome: 'Algoritmos' } } }),
            insc({ status: 'pendente', monitoria: { disciplina: { nome: 'Banco de Dados' } } })
        ];
        expect(D.presencasPorDisciplina(lista)).toEqual([
            { disciplina: 'Cálculo I', n: 2 },
            { disciplina: 'Algoritmos', n: 1 }
        ]);
    });
});
