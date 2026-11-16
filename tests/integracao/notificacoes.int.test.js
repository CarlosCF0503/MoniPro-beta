// Plano 3 (RF-010, RN-011) contra o Postgres real: o aviso entra na fila junto com a ação, o
// lembrete não duplica, duas rodadas ao mesmo tempo não enviam o mesmo aviso duas vezes e uma
// queda do provedor não quebra a inscrição.
const request = require('supertest');
const app = require('../../src/app');
const email = require('../../src/services/email');
const notificacaoService = require('../../src/services/notificacaoService');
const privacidadeService = require('../../src/services/privacidadeService');
const h = require('./helpers');

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

afterAll(() => h.prisma.$disconnect());
beforeEach(async () => {
    await h.limparBanco();
    email.enviados.length = 0;
    jest.restoreAllMocks();
});

async function cenario({ capacidade = 3, emMs = 3 * DIA } = {}) {
    const monitor = await h.criarUsuario('monitor');
    const disciplina = await h.criarDisciplina('Cálculo I');
    const vaga = await h.criarVaga({ monitor, disciplina, emMs, capacidade });
    return { monitor, disciplina, vaga };
}
const inscreverPelaApi = async (aluno, vaga) =>
    request(app)
        .post('/agendamentos')
        .set('Cookie', await h.cookieDe(aluno))
        .set('Origin', 'https://moni-pro.app.br')
        .send({ id_monitoria: vaga.id });
const fila = () => h.prisma.notificacao.findMany({ orderBy: { id: 'asc' } });

describe('Avisos gravados junto com a ação', () => {
    it('inscrição enfileira exatamente um e-mail "inscricao", e a rodada o envia', async () => {
        const { vaga } = await cenario();
        const aluno = await h.criarUsuario('aluno');

        expect((await inscreverPelaApi(aluno, vaga)).status).toBe(201);

        const [aviso, ...resto] = await fila();
        expect(resto).toHaveLength(0);
        expect(aviso).toMatchObject({
            id_usuario: aluno.id,
            modelo: 'inscricao',
            status: 'pendente'
        });
        expect(aviso.dados).toMatchObject({ disciplina: 'Cálculo I', local: 'Sala 101' });

        expect(await notificacaoService.processarFila()).toEqual({ enviadas: 1, falhas: 0 });
        expect(email.enviados).toHaveLength(1);
        expect(email.enviados[0]).toMatchObject({ para: aluno.email, modelo: 'inscricao' });
        const [enviado] = await fila();
        expect(enviado.status).toBe('enviada');
        expect(enviado.enviada_em).not.toBeNull();
    });

    it('inscrição recusada (vaga lotada) não deixa aviso na fila', async () => {
        const { vaga } = await cenario({ capacidade: 1 });
        await inscreverPelaApi(await h.criarUsuario('aluno'), vaga);

        const segunda = await inscreverPelaApi(await h.criarUsuario('aluno'), vaga);

        expect(segunda.status).toBe(409);
        expect(await h.prisma.notificacao.count()).toBe(1);
    });

    it('cancelar a vaga com 3 inscritos enfileira 3 avisos', async () => {
        const { monitor, vaga } = await cenario();
        for (let i = 0; i < 3; i++) await h.inscrever(await h.criarUsuario('aluno'), vaga);

        const resposta = await request(app)
            .put(`/monitorias/${vaga.id}/cancelar`)
            .set('Cookie', await h.cookieDe(monitor))
            .set('Origin', 'https://moni-pro.app.br');

        expect(resposta.status).toBe(200);
        const avisos = await fila();
        expect(avisos).toHaveLength(3);
        expect(avisos.every((a) => a.modelo === 'vaga-cancelada')).toBe(true);
    });

    it('mudar o local avisa os inscritos com o antes e o depois', async () => {
        const { monitor, vaga } = await cenario();
        const aluno = await h.criarUsuario('aluno');
        await h.inscrever(aluno, vaga);

        const resposta = await request(app)
            .patch(`/monitorias/${vaga.id}`)
            .set('Cookie', await h.cookieDe(monitor))
            .set('Origin', 'https://moni-pro.app.br')
            .send({ local: 'Bloco C, sala 7' });

        expect(resposta.status).toBe(200);
        const [aviso] = await fila();
        expect(aviso.modelo).toBe('vaga-alterada');
        expect(aviso.dados).toMatchObject({ local: 'Bloco C, sala 7', local_anterior: 'Sala 101' });
    });

    it('mudar só o assunto não manda aviso', async () => {
        const { monitor, vaga } = await cenario();
        await h.inscrever(await h.criarUsuario('aluno'), vaga);

        await request(app)
            .patch(`/monitorias/${vaga.id}`)
            .set('Cookie', await h.cookieDe(monitor))
            .set('Origin', 'https://moni-pro.app.br')
            .send({ descricao: 'Revisão para a prova' });

        expect(await h.prisma.notificacao.count()).toBe(0);
    });
});

describe('Lembrete de 24h', () => {
    it('rodar duas vezes não enfileira o lembrete duas vezes', async () => {
        const { vaga } = await cenario({ emMs: 22 * HORA });
        await h.inscrever(await h.criarUsuario('aluno'), vaga);

        expect(await notificacaoService.enfileirarLembretes()).toBe(1);
        expect(await notificacaoService.enfileirarLembretes()).toBe(0);
        const [aviso] = await fila();
        expect(aviso.modelo).toBe('lembrete');
    });

    it('sessão a mais de 24h, a menos de 20h ou vaga cancelada: nenhum lembrete', async () => {
        const longe = await cenario({ emMs: 30 * HORA });
        await h.inscrever(await h.criarUsuario('aluno'), longe.vaga);
        const perto = await h.criarVaga({
            monitor: longe.monitor,
            disciplina: longe.disciplina,
            emMs: 10 * HORA
        });
        await h.inscrever(await h.criarUsuario('aluno'), perto);
        const cancelada = await h.criarVaga({
            monitor: longe.monitor,
            disciplina: longe.disciplina,
            emMs: 22 * HORA,
            status: 'cancelada'
        });
        await h.inscrever(await h.criarUsuario('aluno'), cancelada);

        expect(await notificacaoService.enfileirarLembretes()).toBe(0);
    });
});

describe('Envio confiável', () => {
    it('provedor fora do ar: a inscrição responde 201 e o aviso fica pendente com 1 tentativa', async () => {
        const { vaga } = await cenario();
        jest.spyOn(email, 'enviar').mockRejectedValue(new Error('ECONNREFUSED'));

        expect((await inscreverPelaApi(await h.criarUsuario('aluno'), vaga)).status).toBe(201);
        const agora = new Date();
        expect(await notificacaoService.processarFila(agora)).toEqual({ enviadas: 0, falhas: 1 });

        const [aviso] = await fila();
        expect(aviso).toMatchObject({
            status: 'pendente',
            tentativas: 1,
            ultimo_erro: 'ECONNREFUSED'
        });
        expect(aviso.enviar_apos.getTime()).toBe(agora.getTime() + 60 * 1000);
        // Antes da hora marcada, a rodada seguinte não tenta de novo
        expect(await notificacaoService.processarFila(agora)).toEqual({ enviadas: 0, falhas: 0 });
    });

    it('duas rodadas ao mesmo tempo enviam cada aviso uma vez só', async () => {
        const { vaga } = await cenario({ capacidade: 10 });
        for (let i = 0; i < 8; i++) {
            await inscreverPelaApi(await h.criarUsuario('aluno'), vaga);
        }

        const [a, b] = await Promise.all([
            notificacaoService.processarFila(),
            notificacaoService.processarFila()
        ]);

        expect(a.enviadas + b.enviadas).toBe(8);
        expect(email.enviados).toHaveLength(8);
        expect(new Set(email.enviados.map((e) => e.para)).size).toBe(8);
    });
});

describe('LGPD', () => {
    it('excluir a conta apaga os avisos dela', async () => {
        const { vaga } = await cenario();
        const aluno = await h.criarUsuario('aluno');
        await inscreverPelaApi(aluno, vaga);

        const exclusao = await request(app)
            .delete('/perfil')
            .set('Cookie', await h.cookieDe(aluno))
            .set('Origin', 'https://moni-pro.app.br')
            .send({ senha: 'senhaIntegracao1' });

        expect(exclusao.status).toBe(200);
        expect(await h.prisma.notificacao.count()).toBe(0);
    });

    it('a retenção apaga avisos resolvidos há mais de 90 dias e mantém os pendentes', async () => {
        const aluno = await h.criarUsuario('aluno');
        const antigo = new Date(Date.now() - 91 * DIA);
        const base = { id_usuario: aluno.id, modelo: 'inscricao', dados: {} };
        await h.prisma.notificacao.createMany({
            data: [
                { ...base, chave: 'a', status: 'enviada', criado_em: antigo },
                { ...base, chave: 'b', status: 'falhou', criado_em: antigo },
                { ...base, chave: 'c', status: 'pendente', criado_em: antigo },
                { ...base, chave: 'd', status: 'enviada' }
            ]
        });

        const r = await privacidadeService.aplicarRetencao({ aplicar: true });

        expect(r.notificacoes).toBe(2);
        const restantes = (await fila()).map((n) => n.chave).sort();
        expect(restantes).toEqual(['c', 'd']);
    });
});
