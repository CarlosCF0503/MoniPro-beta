// Plano 9 (RF-014), contra o Postgres real: criar a vaga semanal e cancelar esta e as próximas.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
const SEMANA = 7 * h.DIA;
const como = async (usuario) => {
    const cookie = await h.cookieDe(usuario);
    return {
        post: (url, corpo) =>
            request(app).post(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo),
        put: (url) => request(app).put(url).set('Cookie', cookie).set('Origin', ORIGEM)
    };
};
// Dia em Brasília de uma data, como "2026-12-01"
const dia = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
// Primeira vaga daqui a 3 dias, às 18:00 em Brasília (21:00 UTC)
function primeiro() {
    const d = new Date(Date.now() + 3 * h.DIA);
    d.setUTCHours(21, 0, 0, 0);
    return d;
}

async function criarSerie(monitor, disciplina, semanas, extra = {}) {
    const inicio = primeiro();
    const ate = dia(new Date(inicio.getTime() + (semanas - 1) * SEMANA));
    const r = await (
        await como(monitor)
    ).post('/monitorias', {
        id_disciplina: disciplina.id,
        horario: inicio.toISOString(),
        local: 'Sala 12',
        capacidade: 2,
        repeticao: { frequencia: 'semanal', ate },
        ...extra
    });
    return { r, inicio };
}

describe('Criar vaga semanal', () => {
    it('4 semanas: 4 vagas independentes com o mesmo id_serie, 7 dias entre elas', async () => {
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();

        const { r, inicio } = await criarSerie(monitor, disciplina, 4);

        expect(r.status).toBe(201);
        expect(r.body.criadas).toHaveLength(4);
        expect(r.body.puladas).toEqual([]);
        const vagas = await h.prisma.monitoria.findMany({ orderBy: { horario: 'asc' } });
        expect(vagas.map((v) => v.horario.getTime() - inicio.getTime())).toEqual([
            0,
            SEMANA,
            2 * SEMANA,
            3 * SEMANA
        ]);
        expect(new Set(vagas.map((v) => v.id_serie)).size).toBe(1);
        expect(vagas[0].id_serie).toMatch(/^[0-9a-f-]{36}$/);
        expect(vagas.every((v) => v.capacidade === 2 && v.local === 'Sala 12')).toBe(true);
    });

    it('data em que o monitor já tem vaga no mesmo horário é pulada; as outras são criadas', async () => {
        const monitor = await h.criarUsuario('monitor');
        const disciplina = await h.criarDisciplina();
        const inicio = primeiro();
        const ocupada = await h.criarVaga({ monitor, disciplina: await h.criarDisciplina() });
        await h.prisma.monitoria.update({
            where: { id: ocupada.id },
            data: { horario: new Date(inicio.getTime() + SEMANA) }
        });

        const { r } = await criarSerie(monitor, disciplina, 3);

        expect(r.status).toBe(201);
        expect(r.body.criadas).toHaveLength(2);
        expect(r.body.puladas).toEqual([new Date(inicio.getTime() + SEMANA).toISOString()]);
    });

    it('17 semanas: 400 e nada criado', async () => {
        const monitor = await h.criarUsuario('monitor');
        const { r } = await criarSerie(monitor, await h.criarDisciplina(), 17);
        expect(r.status).toBe(400);
        expect(r.body.campos).toHaveProperty(['repeticao.ate']);
        expect(await h.prisma.monitoria.count()).toBe(0);
    });

    it('on-line: todas as vagas levam o link da sala', async () => {
        const monitor = await h.criarUsuario('monitor');
        const { r } = await criarSerie(monitor, await h.criarDisciplina(), 2, {
            local: undefined,
            modalidade: 'online',
            link: 'https://meet.google.com/abc-defg-hij'
        });
        expect(r.status).toBe(201);
        const vagas = await h.prisma.monitoria.findMany();
        expect(vagas.every((v) => v.modalidade === 'online' && v.link)).toBe(true);
    });
});

describe('Cancelar esta e as próximas', () => {
    it('cancela da escolhida em diante; as anteriores ficam; o inscrito é avisado', async () => {
        const monitor = await h.criarUsuario('monitor');
        const aluno = await h.criarUsuario('aluno');
        await criarSerie(monitor, await h.criarDisciplina(), 4);
        const vagas = await h.prisma.monitoria.findMany({ orderBy: { horario: 'asc' } });
        await h.inscrever(aluno, vagas[2]);

        const r = await (await como(monitor)).put(`/monitorias/${vagas[1].id}/cancelar-proximas`);

        expect(r.status).toBe(200);
        expect(r.body.canceladas).toEqual([vagas[1].id, vagas[2].id, vagas[3].id]);
        expect(r.body.mantidas).toEqual([]);
        const depois = await h.prisma.monitoria.findMany({ orderBy: { horario: 'asc' } });
        expect(depois.map((v) => v.status)).toEqual([
            'ativa',
            'cancelada',
            'cancelada',
            'cancelada'
        ]);
        expect(await h.prisma.notificacao.count({ where: { id_usuario: aluno.id } })).toBe(1);
    });

    it('as que começam em menos de 24h ficam; se só sobrar essa, 400 (RN-001)', async () => {
        const monitor = await h.criarUsuario('monitor');
        await criarSerie(monitor, await h.criarDisciplina(), 3);
        const vagas = await h.prisma.monitoria.findMany({ orderBy: { horario: 'asc' } });
        // A primeira passa a começar daqui a 10 horas
        await h.prisma.monitoria.update({
            where: { id: vagas[0].id },
            data: { horario: new Date(Date.now() + 10 * h.HORA) }
        });
        const doMonitor = await como(monitor);

        const r = await doMonitor.put(`/monitorias/${vagas[0].id}/cancelar-proximas`);

        expect(r.status).toBe(200);
        expect(r.body.canceladas).toEqual([vagas[1].id, vagas[2].id]);
        expect(r.body.mantidas.map((v) => v.id)).toEqual([vagas[0].id]);
        const deNovo = await doMonitor.put(`/monitorias/${vagas[0].id}/cancelar-proximas`);
        // Mesma resposta do cancelamento comum fora do prazo (RN-001)
        expect(deNovo.status).toBe(400);
        expect(deNovo.body.erro).toMatch(/24h de antecedência/);
    });

    it('vaga avulsa: 400; vaga de outro monitor: 403', async () => {
        const monitor = await h.criarUsuario('monitor');
        const outro = await h.criarUsuario('monitor');
        const avulsa = await h.criarVaga({ monitor, disciplina: await h.criarDisciplina() });
        await criarSerie(monitor, await h.criarDisciplina(), 2);
        const daSerie = await h.prisma.monitoria.findFirst({ where: { id_serie: { not: null } } });

        const r1 = await (await como(monitor)).put(`/monitorias/${avulsa.id}/cancelar-proximas`);
        const r2 = await (await como(outro)).put(`/monitorias/${daSerie.id}/cancelar-proximas`);
        expect(r1.status).toBe(400);
        expect(r2.status).toBe(403);
    });
});
