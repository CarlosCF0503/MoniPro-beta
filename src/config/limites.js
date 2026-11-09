// src/config/limites.js
// Limites de requisições por IP (R10). Os valores padrão valem em produção e homologação.
// Só a pilha descartável dos testes E2E (docker-compose.e2e.yml) os aumenta, porque lá todas
// as contas e navegadores de teste chegam pelo mesmo IP. Valor ausente ou inválido = padrão.

const PADRAO_TENTATIVAS_AUTH = 10; // login + cadastro, a cada 15 minutos
const PADRAO_REQUISICOES_MINUTO = 120; // todas as rotas

function inteiroPositivoOu(valor, padrao) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : padrao;
}

function limiteTentativasAuth(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_TENTATIVAS_AUTH, PADRAO_TENTATIVAS_AUTH);
}

function limiteRequisicoesPorMinuto(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_REQUISICOES_MINUTO, PADRAO_REQUISICOES_MINUTO);
}

module.exports = { limiteTentativasAuth, limiteRequisicoesPorMinuto };
