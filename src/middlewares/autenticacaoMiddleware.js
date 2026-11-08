const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { NOME_COOKIE_SESSAO } = require('../config/sessao');
const sessaoRepository = require('../repositories/sessaoRepository');
const { lerCookie } = require('../utils/cookies');
const { ErroNaoAutorizado } = require('../utils/erros');

// P3 (R7): o token vem do cookie httpOnly. Durante a transição (primeiro PR) o cabeçalho
// Authorization: Bearer ainda é aceito, para quem estiver com a página antiga aberta; ele sai
// no segundo PR, depois que o frontend publicado usar só o cookie.
function extrairToken(req) {
    const doCookie = lerCookie(req, NOME_COOKIE_SESSAO);
    if (doCookie) return { token: doCookie };

    const authHeader = req.headers.authorization;
    if (!authHeader) return { erro: 'Token não fornecido' };

    const partes = authHeader.split(' ');
    if (partes.length !== 2) return { erro: 'Erro de token' };

    const [esquema, token] = partes;
    if (!/^Bearer$/i.test(esquema)) return { erro: 'Token mal formatado' };
    return { token };
}

const autenticar = async (req, res, next) => {
    const { token, erro } = extrairToken(req);
    if (erro) return res.status(401).json({ erro });

    let decodificado;
    try {
        decodificado = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ erro: 'Token inválido' });
    }

    try {
        // Revogação: o token só vale enquanto a versão dele for a atual do usuário. Tokens
        // emitidos antes desta mudança não têm "v" e contam como versão 0 (o padrão da coluna).
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
