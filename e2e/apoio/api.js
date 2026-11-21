// R1 (E2E): preparação dos dados pela API, como um usuário faria, para que cada teste comece
// com as próprias contas (e-mail @e2e.invalid, nunca reaproveitadas) e só a parte que o caso
// testa passe pela tela.
const { randomInt } = require('node:crypto');
const { expect } = require('@playwright/test');

const COOKIE = 'monipro_sessao';
const SENHA = 'senhaE2e2026';

let contador = 0;
function sufixo() {
    contador += 1;
    return `${Date.now().toString(36)}${process.pid}${contador}`;
}

/**
 * Matrícula aleatória de 9 a 10 dígitos, abaixo do limite do INTEGER do Postgres. O banco exige
 * matrícula+perfil únicos; com essa faixa, uma colisão entre testes é desprezível.
 */
function matriculaUnica() {
    return randomInt(100000000, 2000000000);
}

/**
 * Cria uma conta pela API. Devolve { nome, email, matricula, senha, tipo, id }.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {'aluno'|'monitor'} tipo
 */
async function criarConta(request, tipo, nome) {
    const s = sufixo();
    const conta = {
        nome: nome || `E2E ${tipo} ${s}`,
        email: `${tipo}.${s}@e2e.invalid`,
        matricula: matriculaUnica(),
        senha: SENHA,
        tipo
    };
    const resposta = await request.post('/auth/cadastro', {
        data: {
            nome_completo: conta.nome,
            email: conta.email,
            matricula: conta.matricula,
            senha: conta.senha,
            tipo_usuario: tipo
        }
    });
    expect(resposta.status(), await resposta.text()).toBe(201);
    conta.id = (await resposta.json()).id;
    return conta;
}

/** Faz login pela API e devolve o valor do cookie de sessão. */
async function tokenDe(request, conta) {
    const resposta = await request.post('/auth/login', {
        data: { identificador: conta.email, senha: conta.senha, tipo_usuario: conta.tipo }
    });
    expect(resposta.status(), await resposta.text()).toBe(200);
    const bruto = resposta
        .headersArray()
        .find((h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith(`${COOKIE}=`));
    expect(bruto, 'login sem cookie de sessão').toBeDefined();
    return bruto.value.split(';')[0].slice(COOKIE.length + 1);
}

/**
 * Coloca a sessão da conta no navegador (o mesmo cookie HttpOnly que o login grava), para os
 * casos que não testam o login em si.
 * @param {import('@playwright/test').BrowserContext} contexto
 */
async function entrarNoNavegador(contexto, request, conta, baseURL) {
    const token = await tokenDe(request, conta);
    await contexto.addCookies([
        {
            name: COOKIE,
            value: token,
            url: baseURL,
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
        }
    ]);
}

/** Cliente da API autenticado como a conta (para preparar vagas e inscrições). */
async function clienteDe(request, conta) {
    const token = await tokenDe(request, conta);
    const cabecalhos = { Cookie: `${COOKIE}=${token}` };
    return {
        request,
        get: (url) => request.get(url, { headers: cabecalhos }),
        post: (url, data) => request.post(url, { data, headers: cabecalhos }),
        delete: (url) => request.delete(url, { headers: cabecalhos })
    };
}

// Plano 7: a coordenação fictícia do seed (prisma/seed.js, senha SEED_SENHA da pilha E2E)
const COORDENACAO = {
    email: 'coordenacao@ficticio.invalid',
    senha: process.env.E2E_SENHA_SEED || 'senhaFicticiaE2e1', // pragma: allowlist secret
    tipo: 'coordenador'
};

/**
 * Cria uma disciplina pela API, como o monitor. Plano 7: ela nasce pendente (os alunos não
 * veem); por padrão a coordenação do seed já aprova, para o caso testar o resto do fluxo.
 */
async function criarDisciplina(
    clienteMonitor,
    nome = `Disciplina E2E ${sufixo()}`,
    { aprovar = true } = {}
) {
    const resposta = await clienteMonitor.post('/disciplinas', { nome });
    expect(resposta.status(), await resposta.text()).toBe(201);
    const corpo = await resposta.json();
    const disciplina = corpo.disciplina || corpo;
    if (aprovar) {
        const coordenacao = await clienteDe(clienteMonitor.request, COORDENACAO);
        const r = await coordenacao.post(`/admin/disciplinas/${disciplina.id}/aprovar`, {});
        expect(r.status(), await r.text()).toBe(200);
    }
    return disciplina;
}

/**
 * Cria uma vaga pela API. `horario` é um Date.
 */
async function criarVaga(
    clienteMonitor,
    { disciplina, horario, local = 'Sala E2E', capacidade = 1, descricao }
) {
    const resposta = await clienteMonitor.post('/monitorias', {
        id_disciplina: disciplina.id,
        horario: horario.toISOString(),
        local,
        capacidade,
        ...(descricao ? { descricao } : {})
    });
    expect(resposta.status(), await resposta.text()).toBe(201);
    const corpo = await resposta.json();
    return corpo.monitoria || corpo;
}

async function inscrever(clienteAluno, vaga) {
    const resposta = await clienteAluno.post('/agendamentos', { id_monitoria: vaga.id });
    expect(resposta.status(), await resposta.text()).toBe(201);
    return (await resposta.json()).agendamento;
}

module.exports = {
    SENHA,
    sufixo,
    matriculaUnica,
    criarConta,
    entrarNoNavegador,
    clienteDe,
    criarDisciplina,
    criarVaga,
    inscrever
};
