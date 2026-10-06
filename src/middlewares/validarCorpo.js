// src/middlewares/validarCorpo.js
// Tarefa 9: valida req.body contra um schema zod antes do controller.
// Em caso de sucesso, substitui req.body pelos dados já convertidos e SEM os
// campos não declarados no schema (zod descarta chaves desconhecidas), o que
// também impede que o cliente injete campos como `status` ou `pontos`.

const { ErroValidacao } = require('../utils/erros');

function validarCorpo(schema) {
    return (req, res, next) => {
        const resultado = schema.safeParse(req.body ?? {});

        if (!resultado.success) {
            const campos = {};
            for (const issue of resultado.error.issues) {
                const campo = issue.path.join('.') || 'corpo';
                // Mantém só a primeira mensagem de cada campo
                if (!campos[campo]) campos[campo] = issue.message;
            }
            const primeiraMensagem = Object.values(campos)[0];
            return next(new ErroValidacao(primeiraMensagem, campos));
        }

        req.body = resultado.data;
        return next();
    };
}

module.exports = validarCorpo;
