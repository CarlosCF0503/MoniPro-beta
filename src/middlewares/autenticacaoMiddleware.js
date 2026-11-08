const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { ErroNaoAutorizado } = require('../utils/erros');

const autenticar = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ erro: 'Token não fornecido' });

    const partes = authHeader.split(' ');
    if (partes.length !== 2) return res.status(401).json({ erro: 'Erro de token' });

    const [esquema, token] = partes;
    if (!/^Bearer$/i.test(esquema)) return res.status(401).json({ erro: 'Token mal formatado' });

    jwt.verify(token, JWT_SECRET, (err, decodificado) => {
        if (err) return res.status(401).json({ erro: 'Token inválido' });
        req.usuario = decodificado;
        return next();
    });
}; // ⬅️ FALTAVA FECHAR ESSA CHAVE AQUI!

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
