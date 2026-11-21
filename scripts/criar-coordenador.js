// scripts/criar-coordenador.js
// Plano 7 (RN-014): a conta da coordenação só nasce por aqui, no servidor, nunca pelo cadastro
// público. O script gera uma senha provisória forte e a mostra uma única vez; a pessoa troca
// pela tela "Esqueci minha senha" (perfil Coordenação) ou recebe outra com --nova-senha.
// O e-mail já nasce confirmado e a criação entra na auditoria do painel.
//
// Por padrão só MOSTRA o que faria. Para aplicar, use --aplicar.
// No servidor, dentro do container do backend:
//
//   Criar:       docker-compose exec -T backend node scripts/criar-coordenador.js \
//                  --nome "Profa. Fulana" --email coordenacao@exemplo.edu.br --matricula 1001 --aplicar
//   Nova senha:  docker-compose exec -T backend node scripts/criar-coordenador.js \
//                  --email coordenacao@exemplo.edu.br --nova-senha --aplicar

require('../src/config/env');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/bancoDeDados');
const { cadastroSchema } = require('../src/schemas/autenticacaoSchemas');

const USO =
    'uso: node scripts/criar-coordenador.js --nome "Nome" --email EMAIL --matricula N [--aplicar]\n' +
    '     node scripts/criar-coordenador.js --email EMAIL --nova-senha [--aplicar]';

/** Lê os argumentos. Devolve { erro } quando falta algo ou algo é inválido. */
function lerArgumentos(argv) {
    const valor = (nome) => {
        const i = argv.indexOf(nome);
        return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
    };
    const aplicar = argv.includes('--aplicar');
    const email = valor('--email');
    if (argv.includes('--nova-senha')) {
        if (!email) return { erro: USO };
        return { modo: 'senha', email: email.trim().toLowerCase(), aplicar };
    }
    const r = cadastroSchema
        .pick({ nome_completo: true, email: true, matricula: true })
        .safeParse({ nome_completo: valor('--nome'), email, matricula: valor('--matricula') });
    if (!r.success) {
        const motivos = r.error.issues.map((i) => i.message).join(' ');
        return { erro: `${motivos}\n${USO}` };
    }
    return { modo: 'criar', ...r.data, email: r.data.email.toLowerCase(), aplicar };
}

/** Senha provisória: 16 caracteres sem ambiguidade (sem 0/O, 1/l/I), com letra e número. */
function gerarSenhaProvisoria(bytes = randomBytes(16)) {
    const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'; // pragma: allowlist secret (alfabeto da senha provisória, não é segredo)
    const numeros = '23456789';
    const todos = letras + numeros;
    const chars = [...bytes].map((b) => todos[b % todos.length]);
    chars[0] = letras[bytes[0] % letras.length];
    chars[1] = numeros[bytes[1] % numeros.length];
    return chars.join('');
}

async function criar(args, db) {
    const conflito = await db.usuario.findFirst({
        where: {
            tipo_usuario: 'coordenador',
            OR: [{ email: args.email }, { matricula: args.matricula }]
        },
        select: { id: true }
    });
    if (conflito)
        throw new Error('Já existe uma conta de coordenação com este e-mail ou matrícula.');
    console.log(`${args.aplicar ? 'criando' : 'criaria (simulação)'} a conta de coordenação:`);
    console.log(`  nome: ${args.nome_completo}`);
    console.log(`  e-mail: ${args.email}`);
    console.log(`  matrícula: ${args.matricula}`);
    if (!args.aplicar) return console.log('Rode de novo com --aplicar para criar.');

    const senha = gerarSenhaProvisoria();
    await db.$transaction(async (tx) => {
        const u = await tx.usuario.create({
            data: {
                nome_completo: args.nome_completo,
                email: args.email,
                matricula: args.matricula,
                senha: await bcrypt.hash(senha, 10),
                tipo_usuario: 'coordenador',
                email_confirmado_em: new Date()
            }
        });
        await tx.auditoria.create({
            data: {
                id_usuario: u.id,
                acao: 'criar_coordenador',
                alvo: `usuario:${u.id}`,
                descricao: `Conta de coordenação criada no servidor para ${args.nome_completo}`
            }
        });
    });
    console.log(`senha provisória (aparece só agora): ${senha}`);
    console.log('Entre pela tela de login com o perfil Coordenação e troque a senha.');
}

async function novaSenha(args, db) {
    const u = await db.usuario.findFirst({
        where: { tipo_usuario: 'coordenador', email: args.email, anonimizado_em: null },
        select: { id: true, nome_completo: true }
    });
    if (!u) throw new Error('Nenhuma conta de coordenação com este e-mail.');
    console.log(
        `${args.aplicar ? 'gerando' : 'geraria (simulação)'} senha nova para ${u.nome_completo}.`
    );
    if (!args.aplicar) return console.log('Rode de novo com --aplicar para trocar a senha.');
    const senha = gerarSenhaProvisoria();
    // versao_token + 1 encerra as sessões abertas com a senha antiga
    await db.usuario.update({
        where: { id: u.id },
        data: { senha: await bcrypt.hash(senha, 10), versao_token: { increment: 1 } }
    });
    console.log(`senha provisória (aparece só agora): ${senha}`);
}

async function main(argv = process.argv.slice(2), db = prisma) {
    const args = lerArgumentos(argv);
    if (args.erro) {
        console.error(args.erro);
        process.exitCode = 2;
        return;
    }
    try {
        await (args.modo === 'senha' ? novaSenha(args, db) : criar(args, db));
    } catch (erro) {
        console.error(erro.message);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main().finally(() => prisma.$disconnect());
}

module.exports = { lerArgumentos, gerarSenhaProvisoria, main };
