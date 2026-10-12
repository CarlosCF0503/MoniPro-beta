// src/middlewares/tratadorDeErros.js
// Tarefa 8: middleware central de erro. O Express 5 encaminha para cá as
// promessas rejeitadas dos controllers async, então eles não precisam de
// try/catch — basta o service lançar uma classe de src/utils/erros.js.

const tratarErro = require('../utils/tratarErro');
const logger = require('../utils/logger');

// O Express identifica o middleware de erro pela assinatura de 4 parâmetros
function tratadorDeErros(error, req, res, next) {
    // Resposta já começou a ser enviada: delega ao handler padrão do Express
    if (res.headersSent) return next(error);

    const { statusCode, mensagem, campos } = tratarErro(error);

    if (statusCode >= 500) {
        logger.error(
            { err: error, metodo: req.method, rota: req.originalUrl },
            'Erro inesperado ao processar requisição'
        );
    }

    res.status(statusCode).json({
        success: false,
        erro: mensagem,
        ...(campos && { campos })
    });
}

module.exports = tratadorDeErros;
