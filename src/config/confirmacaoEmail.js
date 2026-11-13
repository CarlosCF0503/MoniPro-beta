// src/config/confirmacaoEmail.js
// Plano 14 (RF-018, RN-017): confirmar o e-mail no cadastro.

// O link de confirmação vale 48 horas e uma vez só
const HORAS_VALIDADE_CONFIRMACAO = 48;

// EXIGIR_CONFIRMACAO_EMAIL=false deixa entrar sem confirmar. Só a pilha descartável do E2E
// (docker-compose.e2e.yml) usa isso: lá não há caixa de entrada para abrir o link. O fluxo
// completo é coberto pelos testes de integração com Postgres real.
function exigirConfirmacaoEmail(env = process.env) {
    return (env.EXIGIR_CONFIRMACAO_EMAIL || '').trim().toLowerCase() !== 'false';
}

module.exports = { HORAS_VALIDADE_CONFIRMACAO, exigirConfirmacaoEmail };
