// CT-13: roda um script de operação (scripts/) dentro do container do backend da pilha E2E,
// do mesmo jeito que no servidor (docker compose exec). Nunca aponta para hml ou prod.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');

/** Roda `node scripts/<arquivo> ...args` no backend e devolve a saída padrão. */
function rodarScript(arquivo, args) {
    return execFileSync(
        'docker',
        [
            'compose',
            '-f',
            'docker-compose.e2e.yml',
            'exec',
            '-T',
            'backend',
            'sh',
            '-c',
            // O backend da pilha lê o certificado do Postgres na partida; o script precisa do mesmo
            'export DB_CA_CERT="$(cat /certs/ca.crt)" && exec node "scripts/$0" "$@"',
            arquivo,
            ...args
        ],
        { cwd: RAIZ, encoding: 'utf8', timeout: 30000 }
    );
}

module.exports = { rodarScript };
