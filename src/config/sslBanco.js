// src/config/sslBanco.js
// Decide as opções de SSL da conexão com o Postgres a partir das variáveis de ambiente.
//
// Regra: SSL com validação de certificado é obrigatório sempre que o banco não está na
// própria máquina (produção e homologação usam o host "db" do docker-compose) ou quando
// NODE_ENV=production. Só um banco em localhost, fora de produção, conecta sem SSL.
// Antes a detecção era pelo domínio "aivencloud.com"; depois da migração para os
// containers isso deixou de valer e um banco remoto podia conectar sem SSL.

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function hostDaUrl(databaseUrl) {
    try {
        return new URL(databaseUrl).hostname;
    } catch {
        return null;
    }
}

function opcoesSsl(env = process.env) {
    const host = hostDaUrl(env.DATABASE_URL);
    const bancoLocal = host !== null && HOSTS_LOCAIS.has(host);
    const exigeSsl = env.NODE_ENV === 'production' || !bancoLocal;

    if (!exigeSsl) return false;

    if (!env.DB_CA_CERT) {
        throw new Error(
            `DB_CA_CERT não definido: obrigatório para validar o SSL do Postgres (host "${host ?? 'inválido'}"). ` +
                'Veja as instruções no .env.example.'
        );
    }

    return { rejectUnauthorized: true, ca: env.DB_CA_CERT.replace(/\\n/g, '\n') };
}

module.exports = { opcoesSsl };
