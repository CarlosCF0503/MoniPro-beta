// R1: utilitários dos testes de integração. Os dados são criados direto no banco (sem passar
// pelo /auth/cadastro, que tem limite de 10 tentativas por 15 minutos) e as sessões são JWT
// assinados com a versão real do usuário, que o middleware confere no banco.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../src/config/bancoDeDados');
const { NOME_COOKIE_SESSAO } = require('../../src/config/sessao');

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

// Mesma ordem das chaves estrangeiras; RESTART IDENTITY volta os ids para 1 a cada teste
async function limparBanco() {
    await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE agendamentos, monitorias, disciplinas, usuarios RESTART IDENTITY CASCADE'
    );
}

let sequencia = 0;
let hashPadrao;

/**
 * Cria um usuário fictício. A senha de todos é "senhaIntegracao1".
 * @param {'aluno'|'monitor'} tipo
 * @param {object} [extra] - campos que sobrescrevem os padrões
 */
async function criarUsuario(tipo, extra = {}) {
    hashPadrao = hashPadrao || (await bcrypt.hash('senhaIntegracao1', 4));
    sequencia += 1;
    return await prisma.usuario.create({
        data: {
            nome_completo: `[FICTÍCIO] ${tipo} ${sequencia}`,
            email: `${tipo}${sequencia}@integracao.invalid`,
            senha: hashPadrao,
            tipo_usuario: tipo,
            matricula: 900000 + sequencia,
            // Plano 14: as contas de teste já nascem com o e-mail confirmado
            email_confirmado_em: new Date(),
            ...extra
        }
    });
}

async function criarDisciplina(nome = `Disciplina ${++sequencia}`) {
    return await prisma.disciplina.create({ data: { nome } });
}

/**
 * Cria uma vaga. `horario` é relativo a agora, em milissegundos (negativo = já passou).
 */
async function criarVaga({ monitor, disciplina, emMs = 3 * DIA, capacidade = 1, status }) {
    return await prisma.monitoria.create({
        data: {
            horario: new Date(Date.now() + emMs),
            local: 'Sala 101',
            capacidade,
            id_monitor: monitor.id,
            id_disciplina: disciplina.id,
            ...(status ? { status } : {})
        }
    });
}

async function inscrever(aluno, vaga) {
    return await prisma.agendamento.create({
        data: { id_aluno: aluno.id, id_monitoria: vaga.id, data_hora: vaga.horario }
    });
}

/** Cabeçalho Cookie com uma sessão válida para o usuário (versão atual do banco). */
async function cookieDe(usuario) {
    const { versao_token: v } = await prisma.usuario.findUnique({
        where: { id: usuario.id },
        select: { versao_token: true }
    });
    const token = jwt.sign(
        { id: usuario.id, nome_completo: usuario.nome_completo, tipo: usuario.tipo_usuario, v },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
    return `${NOME_COOKIE_SESSAO}=${token}`;
}

async function pontosDe(usuario) {
    const { pontos } = await prisma.usuario.findUnique({
        where: { id: usuario.id },
        select: { pontos: true }
    });
    return pontos;
}

module.exports = {
    prisma,
    HORA,
    DIA,
    limparBanco,
    criarUsuario,
    criarDisciplina,
    criarVaga,
    inscrever,
    cookieDe,
    pontosDe
};
