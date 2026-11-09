// R1: prepara o banco de integração uma vez, antes de todos os arquivos de teste.
// 1. Confere que o banco é local e descartável (bancoIntegracao.js).
// 2. Apaga o schema public inteiro: cada execução começa de um banco vazio.
// 3. Aplica as migrações com "prisma migrate deploy", como no deploy. Uma migração quebrada
//    ou fora de ordem (o incidente da coluna pontos) falha aqui, antes de qualquer teste.
// 4. Compara o banco migrado com o schema.prisma: um campo novo no schema sem a migração
//    correspondente faz a suíte falhar.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');
const { urlBancoIntegracao } = require('./bancoIntegracao');

const RAIZ = path.resolve(__dirname, '..', '..');
const PRISMA_CLI = require.resolve('prisma/build/index.js');

function prisma(args, env) {
    return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
        cwd: RAIZ,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

module.exports = async function prepararBancoIntegracao() {
    const url = urlBancoIntegracao();

    const cliente = new Client({ connectionString: url });
    await cliente.connect();
    try {
        await cliente.query('DROP SCHEMA IF EXISTS public CASCADE');
        await cliente.query('CREATE SCHEMA public');
    } finally {
        await cliente.end();
    }

    const env = { ...process.env, DATABASE_URL: url };
    try {
        prisma(['migrate', 'deploy'], env);
    } catch (erro) {
        throw new Error(
            `prisma migrate deploy falhou num banco vazio:\n${erro.stdout}${erro.stderr}`,
            { cause: erro }
        );
    }

    try {
        prisma(
            [
                'migrate',
                'diff',
                '--from-config-datasource',
                '--to-schema',
                'prisma/schema.prisma',
                '--exit-code'
            ],
            env
        );
    } catch (erro) {
        if (erro.status === 2) {
            throw new Error(
                'O schema.prisma tem mudanças sem migração (crie uma com "prisma migrate dev"):\n' +
                    erro.stdout,
                { cause: erro }
            );
        }
        throw new Error(`prisma migrate diff falhou:\n${erro.stdout}${erro.stderr}`, {
            cause: erro
        });
    }
};
