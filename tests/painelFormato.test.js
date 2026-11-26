// Formatação do painel da coordenação (Monipro_web/JS/painel/formato.js): funções puras
const F = require('../Monipro_web/JS/painel/formato.js');

describe('painel da coordenação — formatação', () => {
    test('horas mostra os minutos só quando sobram', () => {
        expect(F.horas(0)).toBe('0h');
        expect(F.horas(120)).toBe('2h');
        expect(F.horas(95)).toBe('1h35');
        expect(F.horas(61)).toBe('1h01');
    });

    test('pct arredonda e usa travessão sem dado', () => {
        expect(F.pct(0.815)).toBe('82%');
        expect(F.pct(0)).toBe('0%');
        expect(F.pct(null)).toBe('—');
        expect(F.pct(undefined)).toBe('—');
    });

    test('milhar usa o separador brasileiro', () => {
        expect(F.milhar(1234567)).toBe('1.234.567');
    });

    test('datas saem no horário de Brasília, qualquer que seja o fuso da máquina', () => {
        // 02:30 UTC do dia 27 ainda é dia 26 em Brasília (UTC-3)
        expect(F.dataCurta('2026-11-27T02:30:00.000Z')).toBe('26/11');
        expect(F.dataHora('2026-11-27T02:30:00.000Z')).toBe('26/11, 23:30');
    });

    test('ico monta um SVG decorativo com o tamanho pedido (20 por padrão)', () => {
        const svg = F.ico(F.ICO.ok);
        expect(svg).toContain('width="20" height="20"');
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).toContain(F.ICO.ok);
        expect(F.ico(F.ICO.x, 14)).toContain('width="14" height="14"');
    });

    test('presencaBaixa: abaixo de 60%, e nunca sem dado', () => {
        expect(F.presencaBaixa({ presenca: 0.59 })).toBe(true);
        expect(F.presencaBaixa({ presenca: 0.6 })).toBe(false);
        expect(F.presencaBaixa({ presenca: null })).toBe(false);
        expect(F.presencaBaixa({})).toBe(false);
    });
});
