// Certificados (RF-005), PR 2, contra o Postgres real: quais vagas entram nas horas do semestre.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const MIN = 60 * 1000;

// Vaga que já aconteceu, finalizada com a duração dada; `confirmar` faz a presença dupla
async function sessao({ monitor, disciplina, horasAtras = 3, minutos = 90, confirmar = true }) {
    const vaga = await h.criarVaga({
        monitor,
        disciplina,
        emMs: -horasAtras * h.HORA,
        capacidade: 3
    });
    await h.prisma.monitoria.update({
        where: { id: vaga.id },
        data: { status: 'realizada', data_fim: new Date(vaga.horario.getTime() + minutos * MIN) }
    });
    const aluno = await h.criarUsuario('aluno');
    const ag = await h.inscrever(aluno, vaga);
    if (confirmar) {
        await h.prisma.agendamento.update({
            where: { id: ag.id },
            data: {
                status: 'concluido',
                presenca_aluno_em: new Date(),
                presenca_monitor_em: new Date()
            }
        });
    }
    return vaga;
}
const elegibilidade = async (monitor, busca = '') =>
    request(app)
        .get('/certificados/elegibilidade' + busca)
        .set('Cookie', await h.cookieDe(monitor));

describe('Horas comprovadas do semestre', () => {
    it('conta só as finalizadas com presença dupla, limita a 4h e separa por disciplina', async () => {
        const monitor = await h.criarUsuario('monitor');
        const calculo = await h.criarDisciplina('Cálculo I');
        const fisica = await h.criarDisciplina('Física I');
        await sessao({ monitor, disciplina: calculo, minutos: 90 });
        await sessao({ monitor, disciplina: fisica, minutos: 300, horasAtras: 8 }); // vale 4h
        await sessao({ monitor, disciplina: calculo, minutos: 60, confirmar: false }); // sem presença
        await h.criarVaga({ monitor, disciplina: calculo, emMs: -2 * h.HORA }); // a finalizar

        const r = await elegibilidade(monitor);

        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({
            minutos: 90 + 240,
            sessoes: 2,
            minimo_minutos: 60,
            pode_emitir: true,
            pendentes: { a_finalizar: 1, sem_presenca: 1 }
        });
        expect(r.body.por_disciplina).toEqual([
            { disciplina: 'Física I', minutos: 240, sessoes: 1 },
            { disciplina: 'Cálculo I', minutos: 90, sessoes: 1 }
        ]);
    });

    it('vagas de outro monitor, canceladas ou futuras não entram', async () => {
        const monitor = await h.criarUsuario('monitor');
        const outro = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        await sessao({ monitor: outro, disciplina });
        await h.criarVaga({ monitor, disciplina, emMs: -3 * h.HORA, status: 'cancelada' });
        await h.criarVaga({ monitor, disciplina, emMs: 3 * h.DIA });

        const r = await elegibilidade(monitor);

        expect(r.body).toMatchObject({ minutos: 0, sessoes: 0, pendentes: { a_finalizar: 0 } });
    });

    it('um semestre não soma as sessões do outro', async () => {
        const monitor = await h.criarUsuario('monitor');
        await sessao({ monitor, disciplina: await h.criarDisciplina() });

        const r = await elegibilidade(monitor, '?periodo=2026.1');

        expect(r.body).toMatchObject({ periodo: '2026.1', minutos: 0 });
    });
});
