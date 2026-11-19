// Plano 12 (RN-016): cálculo do bloqueio por faltas.
const { calcularRestricao } = require('../src/utils/restricao');

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date('2026-11-19T12:00:00.000Z');
const diasAtras = (n) => new Date(AGORA.getTime() - n * DIA);

describe('calcularRestricao', () => {
    it('sem faltas, ou com menos de 3, ninguém fica bloqueado', () => {
        expect(calcularRestricao([], AGORA)).toBeNull();
        expect(calcularRestricao([diasAtras(1), diasAtras(2)], AGORA)).toBeNull();
    });

    it('3 faltas em 30 dias bloqueiam por 7 dias exatos, contados da terceira', () => {
        const terceira = diasAtras(1);
        const r = calcularRestricao([diasAtras(29), diasAtras(10), terceira], AGORA);
        expect(r).toEqual({ ate: new Date(terceira.getTime() + 7 * DIA), faltas: 3 });
    });

    it('3 faltas espalhadas em 31 dias não bloqueiam', () => {
        expect(calcularRestricao([diasAtras(32), diasAtras(10), diasAtras(1)], AGORA)).toBeNull();
    });

    it('o bloqueio termina 7 dias depois: no oitavo dia já pode se inscrever', () => {
        const ausencias = [diasAtras(20), diasAtras(15), diasAtras(8)];
        expect(calcularRestricao(ausencias, AGORA)).toBeNull();
        const naVespera = new Date(AGORA.getTime() - 1.5 * DIA);
        expect(calcularRestricao(ausencias, naVespera)).not.toBeNull();
    });

    it('uma quarta falta estende o bloqueio a partir dela; a ordem das datas não importa', () => {
        const quarta = diasAtras(0.5);
        const r = calcularRestricao([quarta, diasAtras(3), diasAtras(5), diasAtras(6)], AGORA);
        expect(r.ate).toEqual(new Date(quarta.getTime() + 7 * DIA));
        expect(r.faltas).toBe(4);
    });
});
