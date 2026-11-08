const { opcoesSsl } = require('../src/config/sslBanco');

const CA = '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----\\n';

describe('opcoesSsl (conexão com o Postgres)', () => {
    test('banco em localhost fora de produção conecta sem SSL', () => {
        expect(opcoesSsl({ DATABASE_URL: 'postgres://u:s@localhost:5432/x' })).toBe(false);
        expect(opcoesSsl({ DATABASE_URL: 'postgres://u:s@127.0.0.1:5433/x' })).toBe(false);
    });

    test('host "db" do docker-compose exige SSL mesmo sem NODE_ENV (homologação)', () => {
        expect(() => opcoesSsl({ DATABASE_URL: 'postgres://u:s@db:5432/x' })).toThrow(
            /DB_CA_CERT não definido.*host "db"/
        );
    });

    test('NODE_ENV=production exige SSL mesmo com banco em localhost', () => {
        expect(() =>
            opcoesSsl({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:s@localhost/x' })
        ).toThrow(/DB_CA_CERT/);
    });

    test('com a CA definida valida o certificado e converte \\n escapado', () => {
        const ssl = opcoesSsl({ DATABASE_URL: 'postgres://u:s@db:5432/x', DB_CA_CERT: CA });
        expect(ssl.rejectUnauthorized).toBe(true);
        expect(ssl.ca).toBe('-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----\n');
    });

    test('URL inválida ou ausente não desliga o SSL', () => {
        expect(() => opcoesSsl({ DATABASE_URL: 'nao-e-url' })).toThrow(/host "inválido"/);
        expect(() => opcoesSsl({})).toThrow(/DB_CA_CERT/);
    });
});
