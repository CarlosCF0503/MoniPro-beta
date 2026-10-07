const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/env');

function gerarToken({ id, nome_completo = 'Usuário Teste', email = 'teste@exemplo.com', tipo }) {
    return jwt.sign({ id, nome_completo, email, tipo }, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { gerarToken };
