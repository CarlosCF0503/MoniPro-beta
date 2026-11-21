// Plano 9 (RF-014): série semanal no navegador (marcar/datas.js) e "esta e as próximas" no
// perfil do monitor (perfil/dados.js).
const D = require('../Monipro_web/JS/marcar/datas.js');
const P = require('../Monipro_web/JS/perfil/dados.js');

const form = (extra) => ({
    dia: '2027-03-02',
    hora: '18:00',
    local: 'Sala 12',
    capacidade: '2',
    descricao: '',
    modalidade: 'presencial',
    link: '',
    repetir: true,
    ate: '2027-03-23',
    ...extra
});
const AGORA = new Date(2027, 1, 20, 12, 0);

describe('série no formulário', () => {
    it('ocorrencias: toda semana até a data final, inclusive', () => {
        const datas = D.ocorrencias(new Date(2027, 2, 2, 18, 0), '2027-03-23');
        expect(datas.map(D.diaMes)).toEqual(['02/03', '09/03', '16/03', '23/03']);
        expect(datas.every((d) => d.getHours() === 18)).toBe(true);
    });

    it('serieDoForm marca como pulada a data em que o monitor já tem vaga no horário', () => {
        const minhas = [
            { inicio: new Date(2027, 2, 9, 18, 0) },
            { inicio: new Date(2027, 2, 16, 14, 0) }
        ];
        const s = D.serieDoForm(form(), minhas);
        expect(s.datas).toHaveLength(4);
        expect(s.puladas.map(D.diaMes)).toEqual(['09/03']);
        expect(s.criadas).toHaveLength(3);
        expect(D.serieDoForm(form({ repetir: false }), minhas)).toBeNull();
    });

    it('validarVaga: data final ausente, antes do dia ou com mais de 16 vagas', () => {
        expect(D.validarVaga(form(), AGORA, []).ate).toBeUndefined();
        expect(D.validarVaga(form({ ate: '' }), AGORA, []).ate).toMatch(/até quando/);
        expect(D.validarVaga(form({ ate: '2027-03-01' }), AGORA, []).ate).toMatch(/antes do dia/);
        expect(D.validarVaga(form({ ate: '2027-06-15' }), AGORA, []).ate).toBeUndefined();
        expect(D.validarVaga(form({ ate: '2027-06-22' }), AGORA, []).ate).toMatch(/16 vagas/);
    });

    it('todaSemana concorda com o dia (Toda terça, Todo sábado)', () => {
        expect(D.todaSemana(new Date(2027, 2, 2))).toBe('Toda terça-feira');
        expect(D.todaSemana(new Date(2027, 2, 6))).toBe('Todo sábado');
    });
});

describe('proximasDaSerie (perfil do monitor)', () => {
    const vaga = (id, dias, extra = {}) =>
        P.normalizar({
            id,
            horario: new Date(AGORA.getTime() + dias * 24 * 60 * 60 * 1000).toISOString(),
            status: 'ativa',
            id_serie: 's1',
            ...extra
        });

    it('da escolhida em diante, só ativas da mesma série; menos de 24h ficam', () => {
        const vagas = [
            vaga(1, -6), // já passou
            vaga(2, 0.5), // menos de 24h
            vaga(3, 7),
            vaga(4, 14, { status: 'cancelada' }),
            vaga(5, 21),
            vaga(6, 28, { id_serie: 'outra' })
        ];
        const r = P.proximasDaSerie(vagas[1], vagas, AGORA);
        expect(r.cancelaveis.map((v) => v.id)).toEqual([3, 5]);
        expect(r.ficam.map((v) => v.id)).toEqual([2]);
    });

    it('vaga avulsa não tem série', () => {
        const avulsa = vaga(9, 7, { id_serie: null });
        expect(P.proximasDaSerie(avulsa, [avulsa], AGORA)).toEqual({ cancelaveis: [], ficam: [] });
    });
});
