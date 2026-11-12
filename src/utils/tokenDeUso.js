// src/utils/tokenDeUso.js
// Tokens de uso único mandados por e-mail (recuperar senha, confirmar e-mail): 32 bytes
// aleatórios em base64url (43 caracteres). O banco guarda só o SHA-256; o token puro existe
// apenas no link do e-mail.

const crypto = require('node:crypto');

const gerarToken = () => crypto.randomBytes(32).toString('base64url');
const hashDoToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { gerarToken, hashDoToken };
