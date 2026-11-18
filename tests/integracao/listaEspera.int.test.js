// Plano 8 (RF-013, RN-015), contra o Postgres real: lista de espera, promoção e concorrência.
const request = require('supertest');
const app = require('../../src/app');
const h = require('./helpers');

afterAll(() => h.prisma.$disconnect());
beforeEach(() => h.limparBanco());

const ORIGEM = 'https://moni-pro.app.br';
const como = async (usuario) => {
    const cookie = await h.cookieDe(usuario);
    return {
        post: (url, corpo = {}) =>
            request(app).post(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo),
        patch: (url, corpo) =>
            request(app).patch(url).set('Cookie', cookie).set('Origin', ORIGEM).send(corpo),
        put: (url) => request(app).put(url).set('Cookie', cookie).set('Origin', ORIGEM),
        delete: (url) => request(app).delete(url).set('Cookie', cookie).set('Origin', ORIGEM),
        get: (url) => request(app).get(url).set('Cookie', cookie)
    };
};
const statusDe = async (id) =>
    (await h.prisma.agendamento.findUnique({ where: { id } }))?.status ?? 'apagado';
const avisos = (modelo) => h.prisma.notificacao.findMany({ where: { modelo } });

async function vagaLotada({ capacidade = 1, emMs } = {}) {
    const monitor = await h.criarUsuario('monitor');
    const disciplina = await h.criarDisciplina();
    const vaga = await h.criarVaga({ monitor, disciplina, capacidade, ...(emMs ? { emMs } : {}) });
    const inscritos = [];
    for (let i = 0; i < capacidade; i++) {
        const aluno = await h.criarUsuario('aluno');
        inscritos.push({ aluno, ag: await h.inscrever(aluno, vaga) });
    }
    return { monitor, disciplina, vaga, inscritos };
}

describe('Entrar e sair da lista de espera', () => {
    it('lotada: entra na fila, não ocupa lugar, e a fila tem o tamanho da vaga', async () => {
        const { vaga } = await vagaLotada({ capacidade: 1 });
        const ana = await h.criarUsuario('aluno');
        const bia = await h.criarUsuario('aluno');

        const entrada = await (await como(ana)).post(`/monitorias/${vaga.id}/espera`);
        const cheia = await (await como(bia)).post(`/monitorias/${vaga.id}/espera`);
        const direto = await (await como(bia)).post('/agendamentos', { id_monitoria: vaga.id });

        expect(entrada.status).toBe(201);
        expect(entrada.body.posicao).toBe(1);
        expect(entrada.body.agendamento.status).toBe('em_espera');
        expect(cheia.status).toBe(409);
        expect(direto.status).toBe(409);
        expect(direto.body.erro).toMatch(/lotada/);

        const lista = await (await como(bia)).get(`/monitorias/${vaga.id_disciplina}`);
        expect(lista.body.monitorias[0]).toMatchObject({
            vagas_disponiveis: 0,
            na_fila: 1,
            fila_cheia: true
        });
    });

    it('a posição anda quando alguém da frente sai da fila', async () => {
        const { vaga } = await vagaLotada({ capacidade: 2 });
        const [ana, bia] = await Promise.all([h.criarUsuario('aluno'), h.criarUsuario('aluno')]);
        const deAna = await como(ana);
        const deBia = await como(bia);
        const filaAna = (await deAna.post(`/monitorias/${vaga.id}/espera`)).body.agendamento;
        await deBia.post(`/monitorias/${vaga.id}/espera`);

        const antes = await deBia.get('/perfil/agendamentos');
        expect(antes.body.agendamentos[0].posicao_fila).toBe(2);

        const saida = await deAna.delete(`/agendamentos/${filaAna.id}`);
        expect(saida.status).toBe(200);
        expect(saida.body.mensagem).toBe('Você saiu da lista de espera.');

        const depois = await deBia.get('/perfil/agendamentos');
        expect(depois.body.agendamentos[0].posicao_fila).toBe(1);
    });
});

describe('Promoção (RN-015)', () => {
    it('quando um inscrito cancela, o primeiro da fila é inscrito e recebe o e-mail', async () => {
        const { vaga, inscritos } = await vagaLotada({ capacidade: 1 });
        const ana = await h.criarUsuario('aluno');
        const fila = (await (await como(ana)).post(`/monitorias/${vaga.id}/espera`)).body
            .agendamento;

        const cancelamento = await (
            await como(inscritos[0].aluno)
        ).delete(`/agendamentos/${inscritos[0].ag.id}`);

        expect(cancelamento.status).toBe(200);
        const promovida = await h.prisma.agendamento.findUnique({ where: { id: fila.id } });
        expect(promovida.status).toBe('pendente');
        expect(promovida.promovido_em).toBeInstanceOf(Date);
        expect(promovida.liberado_cancelar_em).toBeNull(); // faltam mais de 24h
        const [aviso] = await avisos('espera');
        expect(aviso).toMatchObject({ id_usuario: ana.id, chave: `espera:agendamento:${fila.id}` });
    });

    it('dois cancelamentos ao mesmo tempo promovem duas pessoas diferentes, sem passar da capacidade', async () => {
        const { vaga, inscritos } = await vagaLotada({ capacidade: 2 });
        const naFila = [];
        for (const _ of [1, 2]) {
            const aluno = await h.criarUsuario('aluno');
            naFila.push((await (await como(aluno)).post(`/monitorias/${vaga.id}/espera`)).body);
        }
        const clientes = await Promise.all(inscritos.map(({ aluno }) => como(aluno)));

        const respostas = await Promise.all(
            inscritos.map(({ ag }, i) => clientes[i].delete(`/agendamentos/${ag.id}`))
        );

        expect(respostas.map((r) => r.status)).toEqual([200, 200]);
        const ocupando = await h.prisma.agendamento.count({
            where: { id_monitoria: vaga.id, status: { notIn: ['cancelado', 'em_espera'] } }
        });
        expect(ocupando).toBe(2);
        expect(await statusDe(naFila[0].agendamento.id)).toBe('pendente');
        expect(await statusDe(naFila[1].agendamento.id)).toBe('pendente');
        expect(await avisos('espera')).toHaveLength(2);
    });

    it('cancelamento e inscrição ao mesmo tempo: a vaga nunca passa da capacidade', async () => {
        const { vaga, inscritos } = await vagaLotada({ capacidade: 1 });
        const ana = await h.criarUsuario('aluno');
        await (await como(ana)).post(`/monitorias/${vaga.id}/espera`);
        const outros = await Promise.all([1, 2, 3].map(() => h.criarUsuario('aluno')));
        const deOutros = await Promise.all(outros.map(como));
        const doInscrito = await como(inscritos[0].aluno);

        await Promise.all([
            doInscrito.delete(`/agendamentos/${inscritos[0].ag.id}`),
            ...deOutros.map((c) => c.post('/agendamentos', { id_monitoria: vaga.id }))
        ]);

        const ocupando = await h.prisma.agendamento.count({
            where: { id_monitoria: vaga.id, status: { notIn: ['cancelado', 'em_espera'] } }
        });
        expect(ocupando).toBe(1);
    });

    it('promovido com menos de 24h para o início pode cancelar até o horário', async () => {
        const { vaga, inscritos } = await vagaLotada({ capacidade: 1 });
        const ana = await h.criarUsuario('aluno');
        const deAna = await como(ana);
        const fila = (await deAna.post(`/monitorias/${vaga.id}/espera`)).body.agendamento;
        // A vaga passa a ser daqui a 5h, e o inscrito pode cancelar (vaga alterada)
        const em5h = new Date(Date.now() + 5 * h.HORA);
        await h.prisma.monitoria.update({ where: { id: vaga.id }, data: { horario: em5h } });
        await h.prisma.agendamento.updateMany({
            where: { id_monitoria: vaga.id },
            data: { data_hora: em5h }
        });
        await h.prisma.agendamento.update({
            where: { id: inscritos[0].ag.id },
            data: { liberado_cancelar_em: new Date() }
        });

        await (await como(inscritos[0].aluno)).delete(`/agendamentos/${inscritos[0].ag.id}`);
        const promovida = await h.prisma.agendamento.findUnique({ where: { id: fila.id } });
        expect(promovida.liberado_cancelar_em).toBeInstanceOf(Date);

        const desistencia = await deAna.delete(`/agendamentos/${fila.id}`);
        expect(desistencia.status).toBe(200);
    });

    it('com menos de 2h ninguém é promovido; quem está na fila pode se inscrever no lugar livre', async () => {
        const { vaga, inscritos } = await vagaLotada({ capacidade: 1 });
        const ana = await h.criarUsuario('aluno');
        const deAna = await como(ana);
        const fila = (await deAna.post(`/monitorias/${vaga.id}/espera`)).body.agendamento;
        const em1h59 = new Date(Date.now() + 119 * 60 * 1000);
        await h.prisma.monitoria.update({ where: { id: vaga.id }, data: { horario: em1h59 } });
        await h.prisma.agendamento.update({
            where: { id: inscritos[0].ag.id },
            data: { liberado_cancelar_em: new Date(), data_hora: em1h59 }
        });

        await (await como(inscritos[0].aluno)).delete(`/agendamentos/${inscritos[0].ag.id}`);
        expect(await statusDe(fila.id)).toBe('em_espera');
        expect(await avisos('espera')).toHaveLength(0);

        const inscricao = await deAna.post('/agendamentos', { id_monitoria: vaga.id });
        expect(inscricao.status).toBe(201);
        expect(await statusDe(fila.id)).toBe('pendente');
        expect(await avisos('inscricao')).toHaveLength(1);
    });

    it('o monitor aumenta os lugares: os primeiros da fila entram na hora', async () => {
        const { monitor, vaga } = await vagaLotada({ capacidade: 2 });
        const naFila = [];
        for (const _ of [1, 2]) {
            const aluno = await h.criarUsuario('aluno');
            naFila.push((await (await como(aluno)).post(`/monitorias/${vaga.id}/espera`)).body);
        }

        const edicao = await (
            await como(monitor)
        ).patch(`/monitorias/${vaga.id}`, {
            capacidade: 3
        });

        expect(edicao.status).toBe(200);
        expect(await statusDe(naFila[0].agendamento.id)).toBe('pendente');
        expect(await statusDe(naFila[1].agendamento.id)).toBe('em_espera');
    });

    it('excluir a conta libera o lugar para a fila', async () => {
        const { vaga, inscritos } = await vagaLotada({ capacidade: 1 });
        const ana = await h.criarUsuario('aluno');
        const fila = (await (await como(ana)).post(`/monitorias/${vaga.id}/espera`)).body
            .agendamento;

        const exclusao = await (
            await como(inscritos[0].aluno)
        )
            .delete('/perfil')
            .send({ senha: 'senhaIntegracao1' });

        expect(exclusao.status).toBe(200);
        expect(await statusDe(fila.id)).toBe('pendente');
    });
});

describe('A fila nos outros fluxos', () => {
    it('vaga cancelada: quem está na fila sai dela e recebe o aviso com o texto da fila', async () => {
        const { monitor, vaga } = await vagaLotada({ capacidade: 1 });
        const ana = await h.criarUsuario('aluno');
        const fila = (await (await como(ana)).post(`/monitorias/${vaga.id}/espera`)).body
            .agendamento;

        const r = await (await como(monitor)).put(`/monitorias/${vaga.id}/cancelar`);

        expect(r.status).toBe(200);
        expect(await statusDe(fila.id)).toBe('cancelado');
        const cancelamentos = await avisos('vaga-cancelada');
        expect(cancelamentos).toHaveLength(2);
        expect(cancelamentos.find((a) => a.id_usuario === ana.id).dados.na_fila).toBe(true);
    });

    it('a fila não recebe lembrete, não aparece para o monitor e não confirma presença', async () => {
        const { monitor, vaga } = await vagaLotada({ capacidade: 1, emMs: 22 * h.HORA });
        await h.prisma.monitoria.update({
            where: { id: vaga.id },
            data: { horario: new Date(Date.now() + 22 * h.HORA) }
        });
        const ana = await h.criarUsuario('aluno');
        const fila = await h.prisma.agendamento.create({
            data: {
                id_aluno: ana.id,
                id_monitoria: vaga.id,
                data_hora: new Date(Date.now() + 22 * h.HORA),
                status: 'em_espera'
            }
        });
        await h.prisma.agendamento.updateMany({
            where: { id_monitoria: vaga.id },
            data: { data_hora: new Date(Date.now() + 22 * h.HORA) }
        });

        const notificacaoService = require('../../src/services/notificacaoService');
        await notificacaoService.enfileirarLembretes();
        const lembretes = await avisos('lembrete');
        expect(lembretes.map((a) => a.id_usuario)).not.toContain(ana.id);
        expect(lembretes).toHaveLength(1);

        const doMonitor = await (await como(monitor)).get('/monitorias/monitor/agendamentos');
        expect(doMonitor.body.agendamentos.map((a) => a.id)).not.toContain(fila.id);
        const perfilMonitor = await (await como(monitor)).get('/perfil/monitorias');
        expect(perfilMonitor.body.monitorias[0]).toMatchObject({ inscritos: 1, na_fila: 1 });
    });
});
