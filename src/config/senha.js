// src/config/senha.js
// R20: hash de senha com o bcrypt nativo (o cálculo roda no pool de threads do libuv e não
// trava o event loop do Node, como acontecia com o bcryptjs, escrito em JavaScript).
// Custo 10 = 2^10 rodadas, o mínimo recomendado pela OWASP para bcrypt. Os hashes antigos
// ($2b$, custo 10, gerados pelo bcryptjs) continuam válidos: o formato é o mesmo.

const CUSTO_BCRYPT = 10;

module.exports = { CUSTO_BCRYPT };
