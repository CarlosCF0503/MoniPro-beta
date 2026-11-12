// Base de e-mail (planos 1 e 3): escolha do transporte, endereço do app e modelos
const { transporteEmail, configSmtp, urlDoApp } = require('../src/config/email');
const { montar, escapar } = require('../src/services/email/modelos');

describe('transporteEmail', () => {
    it('respeita EMAIL_TRANSPORTE quando é um valor conhecido', () => {
        expect(transporteEmail({ EMAIL_TRANSPORTE: 'SMTP' })).toBe('smtp');
        expect(transporteEmail({ EMAIL_TRANSPORTE: 'console', SMTP_HOST: 'x' })).toBe('console');
    });

    it('sem a variável: memória nos testes, smtp com SMTP_HOST, console no resto', () => {
        expect(transporteEmail({ NODE_ENV: 'test', SMTP_HOST: 'x' })).toBe('memoria');
        expect(transporteEmail({ SMTP_HOST: 'smtp-relay.brevo.com' })).toBe('smtp');
        expect(transporteEmail({})).toBe('console');
        expect(transporteEmail({ EMAIL_TRANSPORTE: 'carta' })).toBe('console');
    });
});

describe('configSmtp', () => {
    it('usa 587 com STARTTLS obrigatório por padrão (a Oracle bloqueia a 25)', () => {
        const c = configSmtp({ SMTP_HOST: 'h', SMTP_USUARIO: 'u', SMTP_SENHA: 's' });
        expect(c).toMatchObject({ host: 'h', port: 587, secure: false, requireTLS: true });
        expect(c.auth).toEqual({ user: 'u', pass: 's' });
    });

    it('465 usa TLS desde o início', () => {
        expect(configSmtp({ SMTP_PORTA: '465' })).toMatchObject({ port: 465, secure: true });
    });
});

describe('urlDoApp', () => {
    it('usa APP_URL, sem barra no fim', () => {
        expect(urlDoApp({ APP_URL: 'https://dev.moni-pro.app.br/' })).toBe(
            'https://dev.moni-pro.app.br'
        );
    });

    it('sem APP_URL, usa a primeira origem de ALLOWED_ORIGINS', () => {
        expect(
            urlDoApp({ ALLOWED_ORIGINS: 'https://moni-pro.app.br, https://dev.moni-pro.app.br' })
        ).toBe('https://moni-pro.app.br');
        expect(urlDoApp({})).toBe('https://moni-pro.app.br');
    });
});

describe('modelo redefinir-senha', () => {
    const dados = {
        nome: 'Diego Martins',
        tipo: 'monitor',
        link: 'https://moni-pro.app.br/redefinir_senha.html?token=abc_123',
        minutos: 30
    };

    it('leva o link, a validade e o tipo de conta no texto e no HTML', () => {
        const m = montar('redefinir-senha', dados);
        expect(m.assunto).toBe('Seu link para criar uma senha nova');
        expect(m.texto).toContain(dados.link);
        expect(m.texto).toContain('30 minutos');
        expect(m.texto).toContain('Olá, Diego.');
        expect(m.html).toContain(`href="${dados.link}"`);
        expect(m.html).toContain('conta de monitor');
    });

    it('escapa o nome no HTML', () => {
        const m = montar('redefinir-senha', { ...dados, nome: '<script>alert(1)</script> X' });
        expect(m.html).not.toContain('<script>');
        expect(m.html).toContain('&lt;script&gt;');
    });

    it('modelo desconhecido é erro de programação', () => {
        expect(() => montar('nao-existe', {})).toThrow(/desconhecido/);
    });

    it('escapar cobre os cinco caracteres especiais do HTML', () => {
        expect(escapar(`<a href="x" title='y'>&</a>`)).toBe(
            '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
        );
    });
});
