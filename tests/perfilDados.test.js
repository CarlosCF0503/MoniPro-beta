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

    // As horas comprovadas saíram da tela: vêm de GET /certificados/elegibilidade, com a regra
    // da declaração (tests/certificados.test.js). Aqui fica a escolha do término.
    test('términos oferecidos: de 15 em 15 min, só os que já passaram e no máximo 4h', () => {
        const inicio = new Date(2026, 10, 7, 14);
        const minutos = (agora) => D.opcoesTermino(inicio, agora).map((o) => o.minutos);

        expect(minutos(new Date(2026, 10, 7, 14, 10))).toEqual([15]); // 5 min de folga
        expect(minutos(new Date(2026, 10, 7, 14, 40))).toEqual([15, 30, 45]);
        expect(minutos(new Date(2026, 10, 7, 14, 5))).toEqual([]);
        expect(minutos(new Date(2026, 10, 8, 9)).at(-1)).toBe(240);
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
            monitorConfirmou: false,
            ausente: false
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

    test('podeCancelarInscricao libera até o início quando a vaga mudou (editar vaga)', () => {
        const mudou = (horas) =>
            insc({
                liberado_cancelar_em: AGORA.toISOString(),
                monitoria: { horario: new Date(AGORA.getTime() + horas * 3600e3).toISOString() }
            });
        expect(mudou(2).liberado).toBe(true);
        expect(D.podeCancelarInscricao(mudou(2), AGORA)).toBe(true);
        expect(D.podeCancelarInscricao(mudou(-0.1), AGORA)).toBe(false);
        expect(insc({}).liberado).toBe(false);
    });

    test('mudancasDaVaga descreve o antes só do que de fato mudou', () => {
        const horario = (h) => new Date(2026, 10, 12, h, 0).toISOString();
        const mudou = (campos) =>
            insc({
                liberado_cancelar_em: AGORA.toISOString(),
                monitoria: { horario: horario(16), local: 'Bloco D, sala 5' },
                ...campos
            });
        expect(
            D.mudancasDaVaga(mudou({ horario_anterior: horario(14), local_anterior: 'Sala 2' }))
        ).toEqual(['Horário alterado: era qui, 12 nov às 14:00.', 'Local alterado: era Sala 2.']);
        // Voltou a ser como era: não há o que mostrar
        expect(
            D.mudancasDaVaga(
                mudou({ horario_anterior: horario(16), local_anterior: 'Bloco D, sala 5' })
            )
        ).toEqual([]);
        expect(D.mudancasDaVaga(insc({}))).toEqual([]);
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

describe('lista de espera (plano 8)', () => {
    const AGORA_FILA = new Date(2026, 10, 7, 12, 0);
    const naFila = (campos = {}) =>
        D.normalizarMinhaInscricao({
            id: 9,
            status: 'em_espera',
            posicao_fila: 2,
            ...campos,
            monitoria: {
                horario: new Date(2026, 10, 10, 14).toISOString(),
                local: 'Sala 204',
                status: 'ativa',
                disciplina: { nome: 'Cálculo I' },
                monitor: { nome_completo: 'Ana Ribeiro' },
                ...(campos.monitoria || {})
            }
        });

    test('a inscrição em espera traz a posição e fica em Próximas', () => {
        const i = naFila();
        expect(i).toMatchObject({ naFila: true, posicaoFila: 2, promovido: false });
        expect(D.situacaoDoAluno(i, AGORA_FILA)).toBe('fila');
        expect(D.separarInscricoes([i], AGORA_FILA).proximas).toEqual([i]);
    });

    test('depois do início ou com a vaga cancelada, a fila vira "não abriu lugar" no histórico', () => {
        const depois = new Date(2026, 10, 10, 15);
        expect(D.situacaoDoAluno(naFila(), depois)).toBe('semLugar');
        const cancelada = naFila({ monitoria: { status: 'cancelada' } });
        expect(D.situacaoDoAluno(cancelada, AGORA_FILA)).toBe('semLugar');
        expect(D.separarInscricoes([cancelada], AGORA_FILA).historico).toEqual([cancelada]);
    });

    test('sair da fila vale até o início, mesmo com menos de 24h', () => {
        const em2h = new Date(2026, 10, 10, 12);
        expect(D.podeCancelarInscricao(naFila(), em2h)).toBe(true);
        expect(D.podeCancelarInscricao(naFila(), new Date(2026, 10, 10, 14))).toBe(false);
    });

    test('promovido a menos de 24h pode cancelar até o início', () => {
        const promovido = D.normalizarMinhaInscricao({
            id: 9,
            status: 'pendente',
            promovido_em: '2026-11-10T10:00:00Z',
            liberado_cancelar_em: '2026-11-10T10:00:00Z',
            monitoria: { horario: new Date(2026, 10, 10, 14).toISOString(), status: 'ativa' }
        });
        expect(promovido).toMatchObject({ promovido: true, liberado: true, naFila: false });
        expect(D.podeCancelarInscricao(promovido, new Date(2026, 10, 10, 12))).toBe(true);
    });

    test('o perfil do monitor recebe o tamanho da fila', () => {
        expect(vaga({ inscritos: 3, na_fila: 2 }).naFila).toBe(2);
        expect(vaga({ inscritos: 1 }).naFila).toBe(0);
    });
});

describe('monitoria on-line no perfil (plano 11)', () => {
    const insc = (campos = {}, vaga = {}) =>
        D.normalizarMinhaInscricao({
            id: 3,
            status: 'pendente',
            ...campos,
            monitoria: {
                horario: new Date(2026, 10, 10, 14).toISOString(),
                local: 'On-line',
                modalidade: 'online',
                link: 'https://meet.google.com/abc-defg-hij',
                status: 'ativa',
                ...vaga
            }
        });

    test('a inscrição on-line traz o link', () => {
        expect(insc()).toMatchObject({
            online: true,
            link: 'https://meet.google.com/abc-defg-hij'
        });
        expect(insc({}, { link: null }).link).toBeNull();
    });

    test('a sala fica em destaque de 15 min antes até o fim (ou 4h sem término)', () => {
        const i = insc();
        expect(D.salaAberta(i, new Date(2026, 10, 10, 13, 44))).toBe(false);
        expect(D.salaAberta(i, new Date(2026, 10, 10, 13, 45))).toBe(true);
        expect(D.salaAberta(i, new Date(2026, 10, 10, 18, 0))).toBe(true);
        expect(D.salaAberta(i, new Date(2026, 10, 10, 18, 1))).toBe(false);
    });

    test('o perfil do monitor recebe modalidade e link; o link é validado como na API', () => {
        expect(
            vaga({ modalidade: 'online', link: 'https://meet.jit.si/Sala', local: 'On-line' })
        ).toMatchObject({ online: true, link: 'https://meet.jit.si/Sala' });
        expect(D.linkSalaValido('https://us02web.zoom.us/j/1')).toBe(true);
        expect(D.linkSalaValido('https://evilzoom.us/j/1')).toBe(false);
    });
});

describe('faltas (plano 12)', () => {
    test('falta marcada aparece como "ausente" para os dois lados e vai para o histórico', () => {
        const i = D.normalizarMinhaInscricao({
            id: 4,
            status: 'pendente',
            ausente_em: '2026-11-05T19:00:00Z',
            presenca_aluno_em: '2026-11-05T18:30:00Z',
            monitoria: { horario: new Date(2026, 10, 5, 14).toISOString(), status: 'realizada' }
        });
        const agora = new Date(2026, 10, 6, 10);
        expect(i.ausente).toBe(true);
        expect(D.situacaoDoAluno(i, agora)).toBe('ausente');
        expect(D.separarInscricoes([i], agora).historico).toEqual([i]);

        const doMonitor = D.normalizarInscricao({ id: 4, status: 'pendente', ausente_em: 'x' });
        const vagaPassada = { inicio: new Date(2026, 10, 5, 14), status: 'realizada' };
        expect(D.situacaoPresenca(doMonitor, vagaPassada, agora, 'monitor')).toBe('ausente');
        expect(D.presencasAConfirmar([doMonitor], vagaPassada, agora)).toBe(0);
    });
});
