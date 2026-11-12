// src/config/limites.js
// Limites de requisições por IP (R10). Os valores padrão valem em produção e homologação.
// Só a pilha descartável dos testes E2E (docker-compose.e2e.yml) os aumenta, porque lá todas
// as contas e navegadores de teste chegam pelo mesmo IP. Valor ausente ou inválido = padrão.

const PADRAO_TENTATIVAS_AUTH = 10; // login + cadastro, a cada 15 minutos
const PADRAO_REQUISICOES_MINUTO = 120; // todas as rotas
// Recuperar senha (RF-008) e reenviar a confirmação do e-mail (plano 14): pedidos de link por
// hora, por conta e por IP. Cada rota tem os próprios contadores.
const PADRAO_PEDIDOS_SENHA_EMAIL = 3;
const PADRAO_PEDIDOS_SENHA_IP = 10;

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

function limitePedidosSenhaPorEmail(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_PEDIDOS_SENHA_EMAIL, PADRAO_PEDIDOS_SENHA_EMAIL);
}

function limitePedidosSenhaPorIp(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_PEDIDOS_SENHA_IP, PADRAO_PEDIDOS_SENHA_IP);
}

module.exports = {
    limiteTentativasAuth,
    limiteRequisicoesPorMinuto,
    limitePedidosSenhaPorEmail,
    limitePedidosSenhaPorIp
};
