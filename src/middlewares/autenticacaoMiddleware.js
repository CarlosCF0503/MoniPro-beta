const jwt = require('jsonwebtoken');

const autenticar = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ erro: 'Token não fornecido' });

    const partes = authHeader.split(' ');
    if (partes.length !== 2) return res.status(401).json({ erro: 'Erro de token' });

    const [esquema, token] = partes;
    if (!/^Bearer$/i.test(esquema)) return res.status(401).json({ erro: 'Token mal formatado' });

    jwt.verify(token, process.env.JWT_SECRET || 'segredo_padrao', (err, decodificado) => {
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

    return res.status(403).json({ erro: 'Acesso negado. Apenas Monitores podem cadastrar disciplinas.' });
};

module.exports = {
    autenticar,
    isMonitor
};