// Plano 11 (RF-016): monitoria on-line — link da sala e validação da vaga.
const { normalizarLinkSala } = require('../src/utils/linkSala');
const {
    criarMonitoriaSchema,
    atualizarMonitoriaSchema
} = require('../src/schemas/monitoriaSchemas');
const { montar } = require('../src/services/email/modelos');

const amanha = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const base = () => ({ id_disciplina: 3, horario: amanha(), capacidade: 2 });

describe('link da sala', () => {
    it.each([
        'https://meet.google.com/abc-defg-hij',
        'https://teams.microsoft.com/l/meetup-join/19%3ameeting',
        'https://teams.live.com/meet/9876',
        'https://us02web.zoom.us/j/123456789?pwd=abc',
        'https://zoom.us/j/123',
        'https://meet.jit.si/MonitoriaCalculo'
    ])('aceita %s', (link) => {
        expect(normalizarLinkSala(link)).toBe(new URL(link).toString());
    });

    it.each([
        ['http (sem s)', 'http://meet.google.com/abc'],
        ['javascript:', 'javascript:alert(1)'],
        ['outro domínio', 'https://bit.ly/sala'],
        ['domínio que só termina parecido', 'https://evilzoom.us/j/1'],
        ['domínio aceito como subcaminho', 'https://exemplo.com/meet.google.com'],
        ['com usuário embutido', 'https://meet.google.com@exemplo.com/x'],
        ['com porta', 'https://meet.google.com:8443/abc'],
        ['texto qualquer', 'sala 3'],
        ['vazio', '   '],
        ['longo demais', 'https://meet.google.com/' + 'a'.repeat(500)]
    ])('recusa %s', (_caso, link) => {
        expect(normalizarLinkSala(link)).toBeNull();
    });
});

describe('criar vaga on-line', () => {
    it('on-line com link: local vira "On-line"', () => {
        const r = criarMonitoriaSchema.safeParse({
            ...base(),
            modalidade: 'online',
            link: ' https://meet.google.com/abc-defg-hij '
        });
        expect(r.success).toBe(true);
        expect(r.data).toMatchObject({
            modalidade: 'online',
            local: 'On-line',
            link: 'https://meet.google.com/abc-defg-hij'
        });
    });

    it('on-line sem link ou com link de fora da lista: 400 no campo link', () => {
        const sem = criarMonitoriaSchema.safeParse({ ...base(), modalidade: 'online' });
        const fora = criarMonitoriaSchema.safeParse({
            ...base(),
            modalidade: 'online',
            link: 'https://bit.ly/x'
        });
        expect(sem.error.issues[0]).toMatchObject({ path: ['link'] });
        expect(fora.error.issues[0].message).toMatch(/Meet, Microsoft Teams, Zoom ou Jitsi/);
    });

    it('presencial continua igual: local obrigatório e sem link', () => {
        const ok = criarMonitoriaSchema.safeParse({ ...base(), local: 'Sala 204' });
        expect(ok.data).toMatchObject({ modalidade: 'presencial', local: 'Sala 204' });

        const semLocal = criarMonitoriaSchema.safeParse(base());
        expect(semLocal.error.issues[0]).toMatchObject({ path: ['local'] });

        const comLink = criarMonitoriaSchema.safeParse({
            ...base(),
            local: 'Sala 204',
            link: 'https://meet.google.com/abc'
        });
        expect(comLink.error.issues[0].message).toBe('Vaga presencial não tem link de sala.');
    });

    it('editar aceita trocar a modalidade e o link, validando o link', () => {
        expect(
            atualizarMonitoriaSchema.safeParse({
                modalidade: 'online',
                link: 'https://meet.jit.si/Sala'
            }).success
        ).toBe(true);
        expect(atualizarMonitoriaSchema.safeParse({ link: 'http://meet.jit.si/x' }).success).toBe(
            false
        );
    });
});

describe('e-mails da monitoria on-line', () => {
    const d = {
        nome: 'Diego Martins',
        disciplina: 'Cálculo I',
        monitor: 'Ana Ribeiro',
        horario: '2026-11-13T18:00:00.000Z',
        local: 'On-line',
        link: 'https://meet.google.com/abc-defg-hij'
    };

    it('inscrição, lembrete e "abriu um lugar" levam o link da sala', () => {
        for (const modelo of ['inscricao', 'lembrete', 'espera']) {
            const m = montar(modelo, d);
            expect(m.texto).toContain('Link da sala: https://meet.google.com/abc-defg-hij');
            expect(m.html).toContain('href="https://meet.google.com/abc-defg-hij"');
        }
    });

    it('presencial e vaga cancelada não têm a linha do link', () => {
        const { link: _l, ...presencial } = { ...d, local: 'Sala 204' };
        expect(montar('inscricao', presencial).texto).not.toContain('Link da sala');
        expect(montar('vaga-cancelada', { ...d, link: undefined }).texto).not.toContain(
            'Link da sala'
        );
    });

    it('só o link mudou: o assunto diz isso', () => {
        const m = montar('vaga-alterada', { ...d, link_alterado: true });
        expect(m.assunto).toBe('Mudou o link da sala da monitoria de Cálculo I');
        expect(m.texto).toContain('Link da sala: https://meet.google.com/abc-defg-hij');
    });
});
