// Funções puras da tela de marcar monitoria (Monipro_web/JS/marcar/datas.js)
const { MarcarDatas: datas } = require('../Monipro_web/JS/marcar/datas.js');

describe('marcar monitoria — datas', () => {
    test('chave e deChave fazem ida e volta no fuso local', () => {
        const d = new Date(2026, 10, 9, 18, 30);
        expect(datas.chave(d)).toBe('2026-11-09');
        expect(datas.deChave('2026-11-09')).toEqual(new Date(2026, 10, 9));
    });

    test('diaPassado considera hoje como selecionável', () => {
        const agora = new Date(2026, 10, 6, 15, 0);
        expect(datas.diaPassado(new Date(2026, 10, 5, 23, 59), agora)).toBe(true);
        expect(datas.diaPassado(new Date(2026, 10, 6, 8, 0), agora)).toBe(false);
        expect(datas.diaPassado(new Date(2026, 10, 7), agora)).toBe(false);
    });

    test('prazoCancelamento fica 24h antes do início (RN-001)', () => {
        const inicio = new Date(2026, 10, 9, 18, 30);
        expect(datas.prazoCancelamento(inicio)).toEqual(new Date(2026, 10, 8, 18, 30));
    });

    test('mesVizinho atravessa a virada do ano', () => {
        expect(datas.mesVizinho(2026, 11, 1)).toEqual({ ano: 2027, mes: 0 });
        expect(datas.mesVizinho(2026, 0, -1)).toEqual({ ano: 2025, mes: 11 });
    });

    test('iniciais usa o primeiro e o último nome', () => {
        expect(datas.iniciais('Ana Clara Ribeiro')).toBe('AR');
        expect(datas.iniciais('Bruno')).toBe('B');
        expect(datas.iniciais('')).toBe('?');
    });

    test('plural escolhe a forma pela quantidade', () => {
        expect(datas.plural(1, 'horário', 'horários')).toBe('1 horário');
        expect(datas.plural(3, 'horário', 'horários')).toBe('3 horários');
    });
});

describe('marcar monitoria — vagas', () => {
    const daApi = {
        id: '7',
        horario: new Date(2026, 10, 9, 14, 0).toISOString(),
        capacidade: 3,
        vagas_disponiveis: 1,
        local: 'Lab 3',
        descricao: null,
        id_monitor: 4,
        monitor: { nome_completo: 'Ana Ribeiro' }
    };

    test('normalizarVaga converte o formato da API', () => {
        const v = datas.normalizarVaga(daApi);
        expect(v).toMatchObject({
            id: 7,
            monitor: 'Ana Ribeiro',
            idMonitor: 4,
            capacidade: 3,
            livres: 1,
            descricao: ''
        });
        expect(datas.hora(v.inicio)).toBe('14:00');
    });

    test('normalizarVaga sem vagas_disponiveis assume a capacidade toda livre', () => {
        const v = datas.normalizarVaga({ ...daApi, vagas_disponiveis: undefined });
        expect(v.livres).toBe(3);
    });

    test('vagasFuturas descarta o que já passou e ordena por horário', () => {
        const agora = new Date(2026, 10, 9, 12, 0);
        const lista = [
            { id: 1, inicio: new Date(2026, 10, 9, 18, 0) },
            { id: 2, inicio: new Date(2026, 10, 9, 10, 0) },
            { id: 3, inicio: new Date(2026, 10, 9, 14, 0) }
        ];
        expect(datas.vagasFuturas(lista, agora).map((v) => v.id)).toEqual([3, 1]);
    });

    test('contarPorDia agrupa pela data local', () => {
        const lista = [
            { inicio: new Date(2026, 10, 9, 10, 0) },
            { inicio: new Date(2026, 10, 9, 18, 0) },
            { inicio: new Date(2026, 10, 11, 10, 0) }
        ];
        expect(datas.contarPorDia(lista)).toEqual({ '2026-11-09': 2, '2026-11-11': 1 });
    });
});

describe('marcar monitoria — lista de horários', () => {
    test('vai de 07:00 a 22:00, de 15 em 15 minutos', () => {
        const lista = datas.horarios('');
        expect(lista).toHaveLength(61);
        expect(lista[0]).toBe('07:00');
        expect(lista[1]).toBe('07:15');
        expect(lista[lista.length - 1]).toBe('22:00');
    });

    test('mantém um horário fora da grade, na posição certa', () => {
        const lista = datas.horarios('18:10');
        expect(lista).toHaveLength(62);
        expect(lista.indexOf('18:10')).toBe(lista.indexOf('18:00') + 1);
    });

    test('não duplica um horário que já está na grade', () => {
        expect(datas.horarios('14:00')).toHaveLength(61);
    });
});

describe('marcar monitoria — validação da nova vaga', () => {
    const agora = new Date(2026, 10, 6, 12, 0);
    const valido = {
        dia: '2026-11-09',
        hora: '14:00',
        local: 'Lab 3, Bloco C',
        capacidade: '3',
        descricao: ''
    };

    test('formulário completo não tem erros', () => {
        expect(datas.validarVaga(valido, agora, [])).toEqual({});
    });

    test('exige dia, horário futuro, local e capacidade inteira ≥ 1', () => {
        const erros = datas.validarVaga(
            { dia: '', hora: '', local: '  ', capacidade: '0', descricao: '' },
            agora,
            []
        );
        expect(Object.keys(erros).sort()).toEqual(['capacidade', 'dia', 'hora', 'local']);
        expect(
            datas.validarVaga({ ...valido, dia: '2026-11-06', hora: '09:00' }, agora, []).hora
        ).toBe('O horário precisa estar no futuro.');
        expect(datas.validarVaga({ ...valido, capacidade: '2.5' }, agora, []).capacidade).toBe(
            'Número inteiro, mínimo 1.'
        );
    });

    test('respeita os limites do schema (local 120, descrição 500)', () => {
        const erros = datas.validarVaga(
            { ...valido, local: 'x'.repeat(121), descricao: 'y'.repeat(501) },
            agora,
            []
        );
        expect(erros.local).toBe('Máximo de 120 caracteres.');
        expect(erros.descricao).toBe('Máximo de 500 caracteres.');
    });

    test('avisa conflito com outra vaga do mesmo monitor no mesmo horário', () => {
        const minhas = [{ inicio: new Date(2026, 10, 9, 14, 0) }];
        expect(datas.validarVaga(valido, agora, minhas).hora).toBe(
            'Você já tem uma vaga às 14:00 neste dia.'
        );
        expect(datas.validarVaga({ ...valido, hora: '15:00' }, agora, minhas)).toEqual({});
    });
});

describe('marcar monitoria — lista de espera (plano 8)', () => {
    const base = {
        id: 7,
        horario: new Date(2026, 10, 9, 14, 0).toISOString(),
        capacidade: 2,
        monitor: { nome_completo: 'Ana Ribeiro' }
    };

    test('normalizarVaga traz o tamanho da fila e se ela está cheia', () => {
        const v = datas.normalizarVaga({ ...base, vagas_disponiveis: 0, na_fila: 1 });
        expect(v).toMatchObject({ livres: 0, naFila: 1, filaCheia: false });
        expect(datas.normalizarVaga(base)).toMatchObject({ naFila: 0, filaCheia: false });
    });

    test('aceitaFila: só vaga lotada com fila que ainda tem espaço', () => {
        const lotada = datas.normalizarVaga({ ...base, vagas_disponiveis: 0, na_fila: 1 });
        const cheia = datas.normalizarVaga({
            ...base,
            vagas_disponiveis: 0,
            na_fila: 2,
            fila_cheia: true
        });
        const livre = datas.normalizarVaga({ ...base, vagas_disponiveis: 1 });
        expect(datas.aceitaFila(lotada)).toBe(true);
        expect(datas.aceitaFila(cheia)).toBe(false);
        expect(datas.aceitaFila(livre)).toBe(false);
    });
});

describe('marcar monitoria — vaga on-line (plano 11)', () => {
    const form = (extra) => ({
        dia: '2026-11-30',
        hora: '14:00',
        capacidade: '2',
        descricao: '',
        local: '',
        ...extra
    });
    const agora = new Date(2026, 10, 20, 12, 0);

    test('on-line pede o link no lugar do local', () => {
        expect(datas.validarVaga(form({ modalidade: 'online' }), agora)).toMatchObject({
            link: 'Informe o link da sala.'
        });
        expect(
            datas.validarVaga(form({ modalidade: 'online', link: 'https://bit.ly/x' }), agora)
        ).toHaveProperty('link');
        const ok = datas.validarVaga(
            form({ modalidade: 'online', link: 'https://meet.google.com/abc-defg-hij' }),
            agora
        );
        expect(ok).not.toHaveProperty('link');
        expect(ok).not.toHaveProperty('local');
    });

    test('presencial continua exigindo o local', () => {
        expect(datas.validarVaga(form({ modalidade: 'presencial' }), agora)).toHaveProperty(
            'local'
        );
    });

    test('a listagem traz a modalidade', () => {
        const v = datas.normalizarVaga({
            id: 1,
            horario: new Date(2026, 10, 30, 14).toISOString(),
            capacidade: 2,
            modalidade: 'online',
            local: 'On-line'
        });
        expect(v.modalidade).toBe('online');
        expect(datas.linkSalaValido('http://meet.jit.si/x')).toBe(false);
    });
});
