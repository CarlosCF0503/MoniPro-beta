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

describe('Emissão da declaração', () => {
    const emitir = async (monitor) =>
        request(app)
            .post('/certificados')
            .set('Cookie', await h.cookieDe(monitor))
            .set('Origin', 'https://moni-pro.app.br')
            .send({});

    it('duas emissões ao mesmo tempo deixam uma única declaração válida', async () => {
        const monitor = await h.criarUsuario('monitor');
        await sessao({ monitor, disciplina: await h.criarDisciplina() });

        const respostas = await Promise.all([emitir(monitor), emitir(monitor)]);

        expect(respostas.map((r) => r.status)).toEqual([201, 201]);
        const todas = await h.prisma.certificado.findMany({ where: { id_usuario: monitor.id } });
        expect(todas.filter((c) => c.situacao === 'valido')).toHaveLength(1);
        expect(todas.filter((c) => c.situacao === 'substituido')).toHaveLength(1);
    });

    it('emitir de novo substitui a anterior, que continua listada', async () => {
        const monitor = await h.criarUsuario('monitor');
        await sessao({ monitor, disciplina: await h.criarDisciplina() });
        const primeira = (await emitir(monitor)).body.certificado;
        const segunda = (await emitir(monitor)).body.certificado;

        const lista = await request(app)
            .get('/certificados')
            .set('Cookie', await h.cookieDe(monitor));

        expect(lista.body.certificados.map((c) => [c.codigo, c.situacao])).toEqual([
            [segunda.codigo, 'valido'],
            [primeira.codigo, 'substituido']
        ]);
    });

    it('mudar o nome depois não altera a declaração já emitida', async () => {
        const monitor = await h.criarUsuario('monitor', { nome_completo: 'Ana Ribeiro' });
        await sessao({ monitor, disciplina: await h.criarDisciplina('Cálculo I') });
        const { codigo } = (await emitir(monitor)).body.certificado;
        await h.prisma.usuario.update({
            where: { id: monitor.id },
            data: { nome_completo: 'Ana Ribeiro Souza' }
        });

        const r = await request(app)
            .get('/certificados/' + codigo)
            .set('Cookie', await h.cookieDe(monitor));

        expect(r.status).toBe(200);
        expect(r.body.certificado.snapshot).toMatchObject({
            nome: 'Ana Ribeiro',
            carga_minutos: 90,
            por_disciplina: [{ disciplina: 'Cálculo I', minutos: 90, sessoes: 1 }]
        });
    });

    it('sem horas suficientes: 422', async () => {
        const monitor = await h.criarUsuario('monitor');
        await sessao({ monitor, disciplina: await h.criarDisciplina(), minutos: 30 });

        expect((await emitir(monitor)).status).toBe(422);
        expect(await h.prisma.certificado.count()).toBe(0);
    });
});

describe('Verificação pública', () => {
    const emitir = async (monitor) =>
        (
            await request(app)
                .post('/certificados')
                .set('Cookie', await h.cookieDe(monitor))
                .set('Origin', 'https://moni-pro.app.br')
                .send({})
        ).body.certificado;
    const verificar = (codigo) => request(app).get('/certificados/verificar/' + codigo);

    it('sem login confere a situação: a antiga aparece como substituída', async () => {
        const monitor = await h.criarUsuario('monitor', { nome_completo: 'Ana Ribeiro' });
        await sessao({ monitor, disciplina: await h.criarDisciplina() });
        const primeira = await emitir(monitor);
        const segunda = await emitir(monitor);

        const antiga = await verificar(primeira.codigo);
        const nova = await verificar(segunda.codigo);

        expect(antiga.body.declaracao).toMatchObject({
            situacao: 'substituido',
            nome: 'Ana Ribeiro'
        });
        expect(nova.body.declaracao).toMatchObject({ situacao: 'valido', carga_minutos: 90 });
    });

    it('depois de o titular excluir a conta, a declaração continua verificável com o nome (D-C4)', async () => {
        const monitor = await h.criarUsuario('monitor', { nome_completo: 'Ana Ribeiro' });
        await sessao({ monitor, disciplina: await h.criarDisciplina() });
        const { codigo } = await emitir(monitor);

        const exclusao = await request(app)
            .delete('/perfil')
            .set('Cookie', await h.cookieDe(monitor))
            .set('Origin', 'https://moni-pro.app.br')
            .send({ senha: 'senhaIntegracao1' });

        expect(exclusao.status).toBe(200);
        const r = await verificar(codigo);
        expect(r.status).toBe(200);
        expect(r.body.declaracao).toMatchObject({ nome: 'Ana Ribeiro', situacao: 'valido' });
    });
});

describe('Revogação pelo script (PR 5)', () => {
    const certificadoService = require('../../src/services/certificadoService');
    const emitir = async (monitor) =>
        (
            await request(app)
                .post('/certificados')
                .set('Cookie', await h.cookieDe(monitor))
                .set('Origin', 'https://moni-pro.app.br')
                .send({})
        ).body.certificado;
    const verificar = (codigo) => request(app).get('/certificados/verificar/' + codigo);

    it('simular não muda nada; aplicar grava data e motivo e a verificação mostra na hora', async () => {
        const monitor = await h.criarUsuario('monitor');
        await sessao({ monitor, disciplina: await h.criarDisciplina() });
        const { codigo } = await emitir(monitor);
        const impresso = codigo
            .match(/.{1,4}/g)
            .join('-')
            .toLowerCase();

        const simulacao = await certificadoService.revogar(impresso, 'Sessões lançadas por engano');
        expect(simulacao.aplicado).toBe(false);
        expect((await verificar(codigo)).body.declaracao.situacao).toBe('valido');

        const agora = new Date('2026-11-20T12:00:00.000Z');
        await certificadoService.revogar(impresso, '  Sessões lançadas por engano ', {
            aplicar: true,
            agora
        });

        const gravado = await h.prisma.certificado.findUnique({ where: { codigo } });
        expect(gravado).toMatchObject({
            situacao: 'revogado',
            revogado_em: agora,
            motivo_revogacao: 'Sessões lançadas por engano'
        });
        const r = await verificar(codigo);
        expect(r.body.declaracao).toMatchObject({
            situacao: 'revogado',
            revogado_em: agora.toISOString()
        });
        // O motivo fica só no banco e no log: a verificação pública não mostra
        expect(JSON.stringify(r.body)).not.toMatch(/engano/);
    });

    it('revogar de novo, ao mesmo tempo ou depois, grava uma vez só', async () => {
        const monitor = await h.criarUsuario('monitor');
        await sessao({ monitor, disciplina: await h.criarDisciplina() });
        const { codigo } = await emitir(monitor);

        const tentativas = await Promise.allSettled(
            [1, 2].map(() =>
                certificadoService.revogar(codigo, 'Revogação duplicada', { aplicar: true })
            )
        );
        expect(tentativas.filter((t) => t.status === 'fulfilled')).toHaveLength(1);
        expect(tentativas.find((t) => t.status === 'rejected').reason.statusCode).toBe(409);

        await expect(
            certificadoService.revogar(codigo, 'Mais uma vez', { aplicar: true })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('a substituída também pode ser revogada, sem mexer na válida', async () => {
        const monitor = await h.criarUsuario('monitor');
        await sessao({ monitor, disciplina: await h.criarDisciplina() });
        const antiga = await emitir(monitor);
        const nova = await emitir(monitor);

        await certificadoService.revogar(antiga.codigo, 'Cópia antiga circulando', {
            aplicar: true
        });

        expect((await verificar(antiga.codigo)).body.declaracao.situacao).toBe('revogado');
        expect((await verificar(nova.codigo)).body.declaracao.situacao).toBe('valido');
    });
});
