// src/middlewares/validarIdRota.js
// Confere o :id da URL antes de qualquer rota que o use (router.param). Sem isso, um id como
// "abc" virava NaN no parseInt, o Prisma recusava a consulta e a resposta era um 500 registrado
// como erro inesperado. O recurso vem da URL, então um id que não é um número inteiro positivo
// responde 404, como um id que não existe.
const { ErroNaoEncontrado } = require('../utils/erros');

const SO_DIGITOS = /^\d+$/;

/**
 * @param {string} mensagem texto do 404 (ex.: 'Agendamento não encontrado.')
 * @returns {import('express').RequestParamHandler}
 */
function validarIdRota(mensagem) {
    return (req, res, next, valor) => {
        const id = Number(valor);
        if (!SO_DIGITOS.test(valor) || !Number.isSafeInteger(id) || id <= 0) {
            return next(new ErroNaoEncontrado(mensagem));
        }
        return next();
    };
}

module.exports = validarIdRota;
