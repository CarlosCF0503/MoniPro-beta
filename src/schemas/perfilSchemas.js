// src/schemas/perfilSchemas.js
// R3 (LGPD): excluir a conta exige a senha atual, para que uma sessão esquecida aberta não
// baste para apagar a conta de outra pessoa.
const { z } = require('zod');

const excluirContaSchema = z.object({
    senha: z
        .string({ error: 'Informe a sua senha para excluir a conta.' })
        .min(1, 'Informe a sua senha para excluir a conta.')
        .max(72, 'Senha incorreta.')
});

module.exports = { excluirContaSchema };
