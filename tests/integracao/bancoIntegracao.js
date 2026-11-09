// R1: de onde vem o banco dos testes de integração, e a trava que impede apontar para hml ou
// produção. Usado pelo globalSetup (antes de tudo) e pelo ambiente de cada arquivo de teste.

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * URL do banco de integração, já validada. Lança erro se a variável faltar, se o host não for
 * local ou se o nome do banco não terminar em "_integracao": os testes apagam o schema inteiro.
 * @returns {string}
 */
function urlBancoIntegracao(env = process.env) {
    const url = env.DATABASE_URL_INTEGRACAO;
    if (!url) {
        throw new Error(
            'Defina DATABASE_URL_INTEGRACAO (ex.: postgres://monipro:senha@localhost:5434/monipro_integracao). ' + // pragma: allowlist secret
                'Os testes de integração apagam o banco: nunca use o .env de hml ou de produção.'
        );
    }
    let destino;
    try {
        destino = new URL(url);
    } catch (erro) {
        throw new Error('DATABASE_URL_INTEGRACAO não é uma URL válida.', { cause: erro });
    }
    const banco = destino.pathname.replace(/^\//, '');
    if (!HOSTS_LOCAIS.has(destino.hostname) || !banco.endsWith('_integracao')) {
        throw new Error(
            `Banco recusado (${destino.hostname}/${banco}): os testes de integração só rodam num banco ` +
                'local cujo nome termina em "_integracao", porque apagam todos os dados.'
        );
    }
    return url;
}

module.exports = { urlBancoIntegracao };
