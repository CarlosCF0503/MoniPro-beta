// src/config/limites.js
// Limites de requisições por IP (R10). Os valores padrão valem em produção e homologação.
// Só a pilha descartável dos testes E2E (docker-compose.e2e.yml) os aumenta, porque lá todas
// as contas e navegadores de teste chegam pelo mesmo IP. Valor ausente ou inválido = padrão.

const PADRAO_TENTATIVAS_AUTH = 10; // cadastro, troca de senha e e-mail, a cada 15 minutos
const PADRAO_REQUISICOES_MINUTO = 120; // todas as rotas
// Login: só as tentativas que falham contam, a cada 15 minutos. Por conta (e-mail/matrícula +
// perfil), contra força bruta numa conta vinda de vários IPs; por IP, mais folgado, porque a
// rede da faculdade junta muitos alunos num IP só (NAT).
const PADRAO_FALHAS_LOGIN_CONTA = 10;
const PADRAO_FALHAS_LOGIN_IP = 30;
// Recuperar senha (RF-008) e reenviar a confirmação do e-mail (plano 14): pedidos de link por
// hora, por conta e por IP. Cada rota tem os próprios contadores.
const PADRAO_PEDIDOS_SENHA_EMAIL = 3;
const PADRAO_PEDIDOS_SENHA_IP = 10;
// Certificados (PR 4): consultas à verificação pública por minuto, por IP (dificulta varrer códigos)
const PADRAO_VERIFICACOES_MINUTO = 20;

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

function limiteFalhasLoginPorConta(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_FALHAS_LOGIN_CONTA, PADRAO_FALHAS_LOGIN_CONTA);
}

function limiteFalhasLoginPorIp(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_FALHAS_LOGIN_IP, PADRAO_FALHAS_LOGIN_IP);
}

function limitePedidosSenhaPorEmail(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_PEDIDOS_SENHA_EMAIL, PADRAO_PEDIDOS_SENHA_EMAIL);
}

function limitePedidosSenhaPorIp(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_PEDIDOS_SENHA_IP, PADRAO_PEDIDOS_SENHA_IP);
}

function limiteVerificacoesPorMinuto(env = process.env) {
    return inteiroPositivoOu(env.LIMITE_VERIFICACOES_MINUTO, PADRAO_VERIFICACOES_MINUTO);
}

module.exports = {
    limiteTentativasAuth,
    limiteRequisicoesPorMinuto,
    limiteFalhasLoginPorConta,
    limiteFalhasLoginPorIp,
    limitePedidosSenhaPorEmail,
    limitePedidosSenhaPorIp,
    limiteVerificacoesPorMinuto
};
