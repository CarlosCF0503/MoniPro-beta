// src/utils/tratarErro.js
// Centraliza a conversão de erros técnicos em respostas HTTP amigáveis.
// Tarefa 8: o status vem da classe do erro (src/utils/erros.js) ou do código
// do Prisma — nunca do texto de error.message.

const { ErroAplicacao } = require('./erros');

const MENSAGEM_PADRAO = 'Ocorreu um erro inesperado. Tente novamente.';

/**
 * Mapeia erros de aplicação, do Prisma (P2xxx) e do body-parser para
 * { statusCode, mensagem, campos? }. Erros desconhecidos viram 500 com
 * mensagem genérica — nunca expõe stack trace ou mensagem técnica crua.
 * @param {Error} error
 * @returns {{ statusCode: number, mensagem: string, campos?: Object }}
 */
function tratarErro(error) {
    if (error instanceof ErroAplicacao) {
        return { statusCode: error.statusCode, mensagem: error.message, campos: error.campos };
    }

    // JSON malformado no corpo (express.json)
    if (error.type === 'entity.parse.failed') {
        return { statusCode: 400, mensagem: 'Corpo da requisição não é um JSON válido.' };
    }

    // --- Erros do Prisma ---
    if (error.code === 'P2002') {
        const campo = error.meta?.target?.[0];
        if (campo === 'email')
            return { statusCode: 409, mensagem: 'Este e-mail já está cadastrado.' };
        if (campo === 'matricula')
            return { statusCode: 409, mensagem: 'Esta matrícula já está cadastrada.' };
        return { statusCode: 409, mensagem: 'Registro duplicado. Verifique os dados informados.' };
    }

    if (error.code === 'P2025') {
        return { statusCode: 404, mensagem: 'Registro não encontrado.' };
    }

    if (error.code === 'P2003') {
        return {
            statusCode: 400,
            mensagem: 'Referência inválida. Verifique os dados informados.'
        };
    }

    if (error.code === 'P2014') {
        return {
            statusCode: 400,
            mensagem: 'Operação inválida: violação de relacionamento no banco de dados.'
        };
    }

    return { statusCode: 500, mensagem: MENSAGEM_PADRAO };
}

module.exports = tratarErro;
