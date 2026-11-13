// src/utils/tratarErro.js
// Centraliza a conversão de erros técnicos em respostas HTTP amigáveis.
// Tarefa 8: o status vem da classe do erro (src/utils/erros.js) ou do código
// do Prisma — nunca do texto de error.message.

const { ErroAplicacao } = require('./erros');

const MENSAGEM_PADRAO = 'Ocorreu um erro inesperado. Tente novamente.';

// Restrições únicas de prisma/schema.prisma, pelo nome que o Postgres dá ao índice
const CAMPO_POR_INDICE = {
    disciplinas_nome_key: 'nome',
    usuarios_email_tipo_usuario_key: 'email',
    usuarios_matricula_tipo_usuario_key: 'matricula'
};

/**
 * Descobre qual campo repetido gerou o P2002. Sem adaptador, o Prisma informa
 * meta.target (["email"]); com o @prisma/adapter-pg, que é o que roda aqui, o campo
 * não vem e só o nome do índice aparece em meta.driverAdapterError.cause.constraint.
 * @param {Object} [meta]
 * @returns {string|undefined}
 */
function campoDuplicado(meta) {
    const alvo = meta?.target;
    if (Array.isArray(alvo)) return alvo[0];
    if (typeof alvo === 'string') return CAMPO_POR_INDICE[alvo];
    const restricao = meta?.driverAdapterError?.cause?.constraint;
    if (Array.isArray(restricao?.fields)) return restricao.fields[0];
    return CAMPO_POR_INDICE[restricao?.index];
}

/**
 * Mapeia erros de aplicação, do Prisma (P2xxx) e do body-parser para
 * { statusCode, mensagem, campos?, codigo? }. Erros desconhecidos viram 500 com
 * mensagem genérica — nunca expõe stack trace ou mensagem técnica crua.
 * @param {Error} error
 * @returns {{ statusCode: number, mensagem: string, campos?: Object, codigo?: string }}
 */
function tratarErro(error) {
    if (error instanceof ErroAplicacao) {
        return {
            statusCode: error.statusCode,
            mensagem: error.message,
            campos: error.campos,
            codigo: error.codigo
        };
    }

    // JSON malformado no corpo (express.json)
    if (error.type === 'entity.parse.failed') {
        return { statusCode: 400, mensagem: 'Corpo da requisição não é um JSON válido.' };
    }

    // --- Erros do Prisma ---
    if (error.code === 'P2002') {
        const campo = campoDuplicado(error.meta);
        if (campo === 'email')
            return { statusCode: 409, mensagem: 'Este e-mail já está cadastrado.' };
        if (campo === 'matricula')
            return { statusCode: 409, mensagem: 'Esta matrícula já está cadastrada.' };
        // Duas criações simultâneas da mesma disciplina: a segunda cai na unicidade do banco
        if (campo === 'nome')
            return { statusCode: 409, mensagem: 'Já existe uma disciplina com este nome.' };
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
