const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { NOME_COOKIE_SESSAO } = require('../config/sessao');
const sessaoRepository = require('../repositories/sessaoRepository');
const { lerCookie } = require('../utils/cookies');
const { ErroNaoAutorizado } = require('../utils/erros');

// P3 (R7): o token vem só do cookie httpOnly. O cabeçalho Authorization: Bearer, aceito
// durante a transição, deixou de valer.
const autenticar = async (req, res, next) => {
    const token = lerCookie(req, NOME_COOKIE_SESSAO);
    if (!token) return res.status(401).json({ erro: 'Sessão não encontrada. Faça login.' });

    let decodificado;
    try {
        decodificado = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ erro: 'Token inválido' });
    }

    try {
        // Revogação: o token só vale enquanto a versão dele for a atual do usuário
        const versaoAtual = await sessaoRepository.buscarVersao(decodificado.id);
        if (versaoAtual === null || (decodificado.v ?? 0) !== versaoAtual) {
            return res.status(401).json({ erro: 'Sessão encerrada. Faça login novamente.' });
        }
    } catch (erroBanco) {
        return next(erroBanco);
    }

    req.usuario = decodificado;
    return next();
};

// verificando se a propriedade do perfil no token decodificado bate com o que queremos
const isMonitor = (req, res, next) => {
    if (req.usuario && req.usuario.tipo === 'monitor') {
        return next();
    }

    // Vai para o tratador central, que responde { success: false, erro }. A mensagem é genérica
    // porque este middleware protege também as rotas de monitoria, não só as de disciplina.
    return next(new ErroNaoAutorizado('Acesso permitido apenas a monitores.'));
};

module.exports = {
    autenticar,
    isMonitor
};
