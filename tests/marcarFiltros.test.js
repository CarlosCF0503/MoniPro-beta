// Plano 13 (RF-017): filtros de Marcar monitoria no navegador (Monipro_web/JS/marcar/datas.js)
const { MarcarDatas: D } = require('../Monipro_web/JS/marcar/datas.js');

const vaga = (id, hora, minuto, campos = {}) =>
    D.normalizarVaga({
        id,
        horario: new Date(2026, 10, 25, hora, minuto).toISOString(),
        capacidade: 2,
        vagas_disponiveis: 1,
        id_monitor: 1,
        monitor: { nome_completo: 'Ana Ribeiro' },
        ...campos
    });

describe('turno', () => {
    it('manhã até 11:59, tarde de 12:00 a 17:59, noite a partir das 18:00', () => {
        const turnoDe = (h, m) => D.turno(new Date(2026, 10, 25, h, m));
        expect(turnoDe(0, 0)).toBe('manha');
        expect(turnoDe(11, 59)).toBe('manha');
        expect(turnoDe(12, 0)).toBe('tarde');
        expect(turnoDe(17, 59)).toBe('tarde');
        expect(turnoDe(18, 0)).toBe('noite');
        expect(turnoDe(18, 30)).toBe('noite');
        expect(turnoDe(23, 59)).toBe('noite');
    });
});

describe('filtrarVagas', () => {
    const vagas = [
        vaga(1, 9, 0),
        vaga(2, 17, 59, { id_monitor: 2, monitor: { nome_completo: 'Bruno Lima' } }),
        vaga(3, 18, 30, { vagas_disponiveis: 0 }),
        vaga(4, 20, 0, { id_monitor: 2, monitor: { nome_completo: 'Bruno Lima' } })
    ];
    const ids = (f) => D.filtrarVagas(vagas, f).map((v) => v.id);

    it('sem filtro devolve a mesma lista', () => {
        expect(D.filtrarVagas(vagas, D.FILTROS_VAZIOS)).toBe(vagas);
        expect(D.filtrosAtivos(D.FILTROS_VAZIOS)).toBe(false);
    });

    it('noite inclui 18:30 e exclui 17:59', () => {
        expect(ids({ periodo: 'noite' })).toEqual([3, 4]);
        expect(ids({ periodo: 'tarde' })).toEqual([2]);
    });

    it('monitor e só com lugar livre; combinados', () => {
        expect(ids({ monitor: '2' })).toEqual([2, 4]);
        expect(ids({ livres: true })).toEqual([1, 2, 4]);
        expect(ids({ periodo: 'noite', monitor: '1', livres: true })).toEqual([]);
        expect(ids({ monitor: '99' })).toEqual([]);
    });

    it('monitoresDe lista cada monitor uma vez, em ordem alfabética', () => {
        expect(D.monitoresDe(vagas)).toEqual([
            { id: 1, nome: 'Ana Ribeiro' },
            { id: 2, nome: 'Bruno Lima' }
        ]);
    });
});
