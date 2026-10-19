// src/utils/erros.js
// Tarefa 8: erros de negócio carregam o próprio statusCode. Os services lançam
// estas classes e o middleware central (src/middlewares/tratadorDeErros.js)
// monta a resposta HTTP — sem decidir status por error.message.includes(...).

class ErroAplicacao extends Error {
    constructor(mensagem, statusCode = 400) {
        super(mensagem);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
    }
}

// 400 — corpo inválido (Tarefa 9). `campos` mapeia nome do campo → mensagem.
class ErroValidacao extends ErroAplicacao {
    constructor(mensagem, campos) {
        super(mensagem, 400);
        this.campos = campos;
    }
}

// 400 — regra de negócio violada (ex.: RN-001, inscrição duplicada)
class ErroRegraNegocio extends ErroAplicacao {
    constructor(mensagem) {
        super(mensagem, 400);
    }
}

// 401 — credenciais inválidas no login
class ErroCredenciaisInvalidas extends ErroAplicacao {
    constructor(mensagem) {
        super(mensagem, 401);
    }
}

// 403 — usuário autenticado, mas sem permissão sobre o recurso
class ErroNaoAutorizado extends ErroAplicacao {
    constructor(mensagem = 'Você não tem permissão para realizar esta ação.') {
        super(mensagem, 403);
    }
}

// 404 — recurso indicado na URL não existe
class ErroNaoEncontrado extends ErroAplicacao {
    constructor(mensagem = 'Registro não encontrado.') {
        super(mensagem, 404);
    }
}

// 409 — conflito com o estado atual do recurso (ex.: vaga lotada — Tarefa 23)
class ErroConflito extends ErroAplicacao {
    constructor(mensagem) {
        super(mensagem, 409);
    }
}

module.exports = {
    ErroAplicacao,
    ErroValidacao,
    ErroRegraNegocio,
    ErroCredenciaisInvalidas,
    ErroNaoAutorizado,
    ErroNaoEncontrado,
    ErroConflito
};
