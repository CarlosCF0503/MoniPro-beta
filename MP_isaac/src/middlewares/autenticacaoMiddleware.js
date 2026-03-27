const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
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
};