// Funções puras da tela de marcar monitoria (Monipro_web/JS/marcar/datas.js)
const datas = require('../Monipro_web/JS/marcar/datas.js');

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
