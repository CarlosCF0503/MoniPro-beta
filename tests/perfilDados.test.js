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

describe('perfil do monitor — presença dos inscritos (P2, D1)', () => {
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
        ).toEqual({ id: 9, idVaga: 4, aluno: 'Ana', status: 'pendente' });
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

    test('presencasAConfirmar conta só as que podem ser confirmadas agora', () => {
        const lista = [
            inscricao('pendente', 1),
            inscricao('concluido', 2),
            inscricao('pendente', 3)
        ];
        expect(D.presencasAConfirmar(lista, passada, AGORA)).toBe(2);
        expect(D.presencasAConfirmar(lista, vaga({}), AGORA)).toBe(0);
        expect(D.presencasAConfirmar(undefined, passada, AGORA)).toBe(0);
    });
});
