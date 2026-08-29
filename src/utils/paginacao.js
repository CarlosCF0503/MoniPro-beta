// src/utils/paginacao.js
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

function obterParametrosPaginacao(query = {}) {
    let page = parseInt(query.page, 10);
    let limit = parseInt(query.limit, 10);

    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(limit) || limit < 1) limit = LIMITE_PADRAO;
    if (limit > LIMITE_MAXIMO) limit = LIMITE_MAXIMO;

    return { page, limit, skip: (page - 1) * limit, take: limit };
}

function montarPaginacao({ page, limit }, total) {
    return {
        page,
        limit,
        total,
        totalPaginas: Math.max(Math.ceil(total / limit), 1)
    };
}

module.exports = { obterParametrosPaginacao, montarPaginacao };
