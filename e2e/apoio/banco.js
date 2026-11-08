// R1 (E2E): acesso direto ao banco da pilha E2E, usado só para "voltar no tempo" (CT-11):
// a confirmação de presença só vale depois do horário da sessão, e a API não cria vagas no
// passado. O banco é o da pilha descartável (porta 5435 da máquina), nunca hml ou prod.
const { Client } = require('pg');

const URL_BANCO =
    process.env.E2E_DATABASE_URL ||
    `postgres://monipro:e2e-somente-local@localhost:${process.env.E2E_PORTA_DB || '5435'}/monipro_e2e`; // pragma: allowlist secret

async function comBanco(fn) {
    const cliente = new Client({ connectionString: URL_BANCO });
    await cliente.connect();
    try {
        return await fn(cliente);
    } finally {
        await cliente.end();
    }
}

/** Move a vaga (e as inscrições dela) para `horasAtras` horas antes de agora. */
async function moverVagaParaOPassado(idVaga, horasAtras = 2) {
    await comBanco(async (c) => {
        await c.query(
            `UPDATE monitorias SET horario = now() - make_interval(hours => $2) WHERE id = $1`,
            [idVaga, horasAtras]
        );
        await c.query(
            `UPDATE agendamentos SET data_hora = now() - make_interval(hours => $2) WHERE id_monitoria = $1`,
            [idVaga, horasAtras]
        );
    });
}

module.exports = { moverVagaParaOPassado };
