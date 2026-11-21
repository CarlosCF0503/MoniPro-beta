// Plano 9 (RF-014): datas da vaga semanal e validação do pedido.
const { gerarOcorrencias, diaNoCampus } = require('../src/utils/recorrencia');
const { criarMonitoriaSchema } = require('../src/schemas/monitoriaSchemas');

// Datas em UTC, para o teste não depender do fuso da máquina. 21:00 UTC = 18:00 em Brasília.
const TERCA = new Date('2027-03-02T21:00:00.000Z');

describe('gerarOcorrencias', () => {
    it('toda semana, no mesmo horário, até o dia final inclusive', () => {
        const datas = gerarOcorrencias(TERCA, '2027-03-23');
        expect(datas.map((d) => d.toISOString())).toEqual([
            '2027-03-02T21:00:00.000Z',
            '2027-03-09T21:00:00.000Z',
            '2027-03-16T21:00:00.000Z',
            '2027-03-23T21:00:00.000Z'
        ]);
    });

    it('o dia final conta no fuso do campus: 23:30 em Brasília já é o dia seguinte em UTC', () => {
        const noite = new Date('2027-03-03T02:30:00.000Z'); // terça, 23:30 em Brasília
        expect(diaNoCampus(noite)).toBe('2027-03-02');
        expect(gerarOcorrencias(noite, '2027-03-09')).toHaveLength(2);
    });

    it('para em 17 datas, para quem chama saber que passou do limite', () => {
        expect(gerarOcorrencias(TERCA, '2028-12-31')).toHaveLength(17);
    });
});

describe('criarMonitoriaSchema com repetição', () => {
    const pedido = (ate, extra = {}) => ({
        id_disciplina: 1,
        horario: TERCA.toISOString(),
        local: 'Sala 12',
        repeticao: { frequencia: 'semanal', ate },
        ...extra
    });
    const erro = (dados) => {
        const r = criarMonitoriaSchema.safeParse(dados);
        return r.success ? null : r.error.issues[0];
    };

    beforeAll(() => {
        jest.useFakeTimers({ now: new Date('2027-02-20T12:00:00.000Z') });
    });
    afterAll(() => jest.useRealTimers());

    it('16 semanas passam; 17 dão erro na data final', () => {
        expect(erro(pedido('2027-06-15'))).toBeNull(); // 16ª terça
        const e = erro(pedido('2027-06-22'));
        expect(e.path).toEqual(['repeticao', 'ate']);
        expect(e.message).toMatch(/no máximo 16 vagas/);
    });

    it('data final antes do primeiro dia: erro', () => {
        expect(erro(pedido('2027-03-01')).message).toMatch(/não pode ser antes/);
    });

    it('frequência que não é semanal e data mal formada: erro', () => {
        expect(
            erro(pedido('2027-03-23', { repeticao: { frequencia: 'mensal', ate: '2027-03-23' } }))
                .message
        ).toMatch(/toda semana/);
        expect(erro(pedido('23/03/2027')).message).toMatch(/AAAA-MM-DD/);
    });
});
