// Base de e-mail (planos 1 e 3): escolha do transporte, endereço do app e modelos
const { transporteEmail, configSmtp, urlDoApp, avisosEmail } = require('../src/config/email');
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

    it('pula origens locais: o link do e-mail precisa abrir fora do servidor', () => {
        expect(
            urlDoApp({
                ALLOWED_ORIGINS:
                    'http://localhost:8080,http://127.0.0.1:5500, https://dev.moni-pro.app.br'
            })
        ).toBe('https://dev.moni-pro.app.br');
        expect(urlDoApp({ ALLOWED_ORIGINS: 'http://localhost:8080' })).toBe(
            'http://localhost:8080'
        );
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

describe('avisosEmail', () => {
    it('avisa quando o envio real está ligado e falta APP_URL', () => {
        const avisos = avisosEmail({
            SMTP_HOST: 'smtp-relay.brevo.com',
            ALLOWED_ORIGINS: 'https://moni-pro.app.br,https://dev.moni-pro.app.br'
        });
        expect(avisos).toHaveLength(1);
        expect(avisos[0]).toMatch(/APP_URL/);
        expect(avisos[0]).toMatch(/https:\/\/moni-pro\.app\.br/);
    });

    it('não avisa com APP_URL definida nem sem envio real', () => {
        expect(
            avisosEmail({
                SMTP_HOST: 'smtp-relay.brevo.com',
                APP_URL: 'https://dev.moni-pro.app.br'
            })
        ).toEqual([]);
        expect(avisosEmail({ EMAIL_TRANSPORTE: 'console' })).toEqual([]);
        expect(avisosEmail({ NODE_ENV: 'test' })).toEqual([]);
    });
});
