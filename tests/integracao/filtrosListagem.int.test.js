// Plano 13 (RF-017), contra o Postgres real: filtros de GET /monitorias/:idDisciplina por turno
// (hora de Brasília), monitor e "só com lugar livre", com paginação.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

// Daqui a 10 dias, no horário de Brasília (UTC-3 o ano todo)
const DIA_BASE = new Date(Date.now() + 10 * h.DIA);
function emBrasilia(hora, minuto = 0, diasAMais = 0) {
    return new Date(
        Date.UTC(
            DIA_BASE.getUTCFullYear(),
            DIA_BASE.getUTCMonth(),
            DIA_BASE.getUTCDate() + diasAMais,
            hora + 3,
            minuto
        )
    );
}

async function cenario() {
    const ana = await h.criarUsuario('monitor');
    const bruno = await h.criarUsuario('monitor');
    const aluno = await h.criarUsuario('aluno');
    const disciplina = await h.criarDisciplina();
    const vaga = async (monitor, hora, minuto, capacidade = 1) => {
        const v = await h.criarVaga({ monitor, disciplina, capacidade });
        return await h.prisma.monitoria.update({
            where: { id: v.id },
            data: { horario: emBrasilia(hora, minuto) }
        });
    };
    const v = {
        manha: await vaga(ana, 11, 59),
        tarde: await vaga(ana, 12, 0),
        fimTarde: await vaga(bruno, 17, 59),
        noite: await vaga(bruno, 18, 30),
        tardeNoite: await vaga(ana, 23, 0, 2)
    };
    const cookie = await h.cookieDe(aluno);
    const listar = async (query) => {
        const r = await request(app)
            .get(`/monitorias/${disciplina.id}${query}`)
            .set('Cookie', cookie);
        expect(r.status).toBe(200);
        return r.body;
    };
    return { ana, bruno, aluno, disciplina, v, listar };
}
const ids = (corpo) => corpo.monitorias.map((m) => m.id);

describe('Filtro por turno (hora de Brasília)', () => {
    it('noite inclui 18:30 e 23:00 e exclui 17:59; tarde vai de 12:00 a 17:59; manhã até 11:59', async () => {
        const { v, listar } = await cenario();

        expect(ids(await listar('?periodo=noite'))).toEqual([v.noite.id, v.tardeNoite.id]);
        expect(ids(await listar('?periodo=tarde'))).toEqual([v.tarde.id, v.fimTarde.id]);
        expect(ids(await listar('?periodo=manha'))).toEqual([v.manha.id]);
    });
});

describe('Filtro por monitor e por lugar livre', () => {
    it('monitor traz só as vagas dele; monitor que não existe devolve lista vazia', async () => {
        const { bruno, v, listar } = await cenario();

        expect(ids(await listar(`?monitor=${bruno.id}`))).toEqual([v.fimTarde.id, v.noite.id]);
        const vazio = await listar('?monitor=999999');
        expect(vazio.monitorias).toEqual([]);
        expect(vazio.paginacao.total).toBe(0);
    });

    it('livres=1 esconde as lotadas (a fila e as canceladas não ocupam lugar)', async () => {
        const { aluno, v, listar } = await cenario();
        await h.inscrever(aluno, v.manha); // lotada (capacidade 1)
        const outro = await h.criarUsuario('aluno');
        const cancelada = await h.inscrever(outro, v.tarde);
        await h.prisma.agendamento.update({
            where: { id: cancelada.id },
            data: { status: 'cancelado' }
        });
        const naFila = await h.inscrever(outro, v.fimTarde);
        await h.prisma.agendamento.update({
            where: { id: naFila.id },
            data: { status: 'em_espera' }
        });
        await h.inscrever(aluno, v.tardeNoite); // 1 de 2: ainda tem lugar

        const corpo = await listar('?livres=1');

        expect(ids(corpo)).toEqual([v.tarde.id, v.fimTarde.id, v.noite.id, v.tardeNoite.id]);
        expect(corpo.monitorias.find((m) => m.id === v.tardeNoite.id).vagas_disponiveis).toBe(1);
    });

    it('filtros combinam, ignoram vagas canceladas e de outra disciplina', async () => {
        const { ana, disciplina, v, listar } = await cenario();
        const extra = await h.criarVaga({ monitor: ana, disciplina, status: 'cancelada' });
        await h.prisma.monitoria.update({
            where: { id: extra.id },
            data: { horario: emBrasilia(20, 0) }
        });
        const outra = await h.criarVaga({ monitor: ana, disciplina: await h.criarDisciplina() });
        await h.prisma.monitoria.update({
            where: { id: outra.id },
            data: { horario: emBrasilia(21, 0) }
        });

        expect(ids(await listar(`?periodo=noite&monitor=${ana.id}&livres=1`))).toEqual([
            v.tardeNoite.id
        ]);
    });
});

describe('Paginação com filtro', () => {
    it('página e total contam só o que passou no filtro, em ordem de horário', async () => {
        const { v, listar } = await cenario();

        const p1 = await listar('?periodo=tarde&limit=1&page=1');
        const p2 = await listar('?periodo=tarde&limit=1&page=2');
        const p3 = await listar('?periodo=tarde&limit=1&page=3');

        expect(ids(p1)).toEqual([v.tarde.id]);
        expect(ids(p2)).toEqual([v.fimTarde.id]);
        expect(ids(p3)).toEqual([]);
        expect(p1.paginacao).toMatchObject({ total: 2, totalPaginas: 2 });
    });
});
