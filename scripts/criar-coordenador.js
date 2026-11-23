// scripts/criar-coordenador.js
// Plano 7 (RN-014): a conta da coordenação só nasce por aqui, no servidor, nunca pelo cadastro
// público. A pessoa recebe um convite por e-mail com o link "Defina sua senha" (vale 48 horas e
// uma vez); nenhuma senha passa pelo terminal. A conta nasce com uma senha aleatória que ninguém
// conhece, o e-mail já confirmado e a criação entra na auditoria do painel.
// Convite vencido: a própria pessoa pede um link em "Esqueci minha senha" (perfil Coordenação),
// ou quem cuida do servidor manda outro com --reenviar-convite.
//
// Por padrão só MOSTRA o que faria. Para aplicar, use --aplicar.
// No servidor, dentro do container do backend:
//
//   Convidar:   docker-compose exec -T backend node scripts/criar-coordenador.js \
//                 --nome "Profa. Fulana" --email coordenacao@exemplo.edu.br --matricula 1001 --aplicar
//   Reenviar:   docker-compose exec -T backend node scripts/criar-coordenador.js \
//                 --email coordenacao@exemplo.edu.br --reenviar-convite --aplicar
//
// Só no banco local (sem SMTP): --mostrar-link também escreve o link do convite no terminal.

require('../src/config/env');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const { CUSTO_BCRYPT } = require('../src/config/senha');
const prisma = require('../src/config/bancoDeDados');
const { cadastroSchema } = require('../src/schemas/autenticacaoSchemas');
const { gerarToken, hashDoToken } = require('../src/utils/tokenDeUso');
const { urlDoApp, transporteEmail } = require('../src/config/email');
const email = require('../src/services/email');

const HORAS_CONVITE = 48;

const USO =
    'uso: node scripts/criar-coordenador.js --nome "Nome" --email EMAIL --matricula N [--aplicar]\n' +
    '     node scripts/criar-coordenador.js --email EMAIL --reenviar-convite [--aplicar]\n' +
    '     (local, sem SMTP: --mostrar-link escreve o link no terminal)';

/** Lê os argumentos. Devolve { erro } quando falta algo ou algo é inválido. */
function lerArgumentos(argv) {
    const valor = (nome) => {
        const i = argv.indexOf(nome);
        return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
    };
    const aplicar = argv.includes('--aplicar');
    const mostrarLink = argv.includes('--mostrar-link');
    const emailInformado = valor('--email');
    if (argv.includes('--reenviar-convite')) {
        if (!emailInformado) return { erro: USO };
        return {
            modo: 'reenviar',
            email: emailInformado.trim().toLowerCase(),
            aplicar,
            mostrarLink
        };
    }
    const r = cadastroSchema.pick({ nome_completo: true, email: true, matricula: true }).safeParse({
        nome_completo: valor('--nome'),
        email: emailInformado,
        matricula: valor('--matricula')
    });
    if (!r.success) {
        const motivos = r.error.issues.map((i) => i.message).join(' ');
        return { erro: `${motivos}\n${USO}` };
    }
    return { modo: 'criar', ...r.data, email: r.data.email.toLowerCase(), aplicar, mostrarLink };
}

/** Grava um convite novo (invalida os abertos) e devolve o link com o token puro. */
async function gravarConvite(idUsuario, tx, agora) {
    const token = gerarToken();
    await tx.tokenRedefinicao.updateMany({
        where: { id_usuario: idUsuario, usado_em: null },
        data: { usado_em: agora }
    });
    await tx.tokenRedefinicao.create({
        data: {
            id_usuario: idUsuario,
            hash: hashDoToken(token),
            expira_em: new Date(agora.getTime() + HORAS_CONVITE * 60 * 60 * 1000)
        }
    });
    return `${urlDoApp()}/redefinir_senha.html?convite=1&token=${token}`;
}

/** Manda o convite. Se o e-mail falhar, a conta continua criada e o comando diz como reenviar. */
async function enviarConvite({ para, nome, link, mostrarLink }) {
    if (mostrarLink) console.log(`link do convite (só para teste local): ${link}`);
    if (transporteEmail() === 'console') {
        console.log(
            'EMAIL_TRANSPORTE=console: o e-mail não sai deste ambiente.' +
                (mostrarLink ? '' : ' Use --reenviar-convite --mostrar-link para ver o link.')
        );
        return;
    }
    try {
        await email.enviar({
            para,
            modelo: 'convite-coordenacao',
            dados: { nome, link, horas: HORAS_CONVITE }
        });
        console.log(`convite enviado para ${para} (vale ${HORAS_CONVITE} horas).`);
    } catch (erro) {
        console.error(`o e-mail não saiu: ${erro.message}`);
        console.error('Confira o SMTP e rode de novo com --reenviar-convite --aplicar.');
        process.exitCode = 1;
    }
}

async function criar(args, db, agora) {
    const conflito = await db.usuario.findFirst({
        where: {
            tipo_usuario: 'coordenador',
            OR: [{ email: args.email }, { matricula: args.matricula }]
        },
        select: { id: true }
    });
    if (conflito)
        throw new Error('Já existe uma conta de coordenação com este e-mail ou matrícula.');
    console.log(`${args.aplicar ? 'convidando' : 'convidaria (simulação)'} para a coordenação:`);
    console.log(`  nome: ${args.nome_completo}`);
    console.log(`  e-mail: ${args.email}`);
    console.log(`  matrícula: ${args.matricula}`);
    if (!args.aplicar) return console.log('Rode de novo com --aplicar para criar e convidar.');

    // Senha aleatória descartada: a conta só passa a ter senha pelo link do convite
    const senhaInutil = randomBytes(32).toString('base64url');
    const link = await db.$transaction(async (tx) => {
        const u = await tx.usuario.create({
            data: {
                nome_completo: args.nome_completo,
                email: args.email,
                matricula: args.matricula,
                senha: await bcrypt.hash(senhaInutil, CUSTO_BCRYPT),
                tipo_usuario: 'coordenador',
                email_confirmado_em: agora
            }
        });
        await tx.auditoria.create({
            data: {
                id_usuario: u.id,
                acao: 'criar_coordenador',
                alvo: `usuario:${u.id}`,
                descricao: `Conta de coordenação criada no servidor para ${args.nome_completo}, com convite por e-mail`
            }
        });
        return gravarConvite(u.id, tx, agora);
    });
    await enviarConvite({
        para: args.email,
        nome: args.nome_completo,
        link,
        mostrarLink: args.mostrarLink
    });
}

async function reenviar(args, db, agora) {
    const u = await db.usuario.findFirst({
        where: { tipo_usuario: 'coordenador', email: args.email, anonimizado_em: null },
        select: { id: true, nome_completo: true, email: true }
    });
    if (!u) throw new Error('Nenhuma conta de coordenação com este e-mail.');
    console.log(
        `${args.aplicar ? 'reenviando' : 'reenviaria (simulação)'} o convite para ${u.nome_completo}.`
    );
    if (!args.aplicar) return console.log('Rode de novo com --aplicar para reenviar.');
    const link = await db.$transaction(async (tx) => {
        await tx.auditoria.create({
            data: {
                id_usuario: u.id,
                acao: 'convidar_coordenador',
                alvo: `usuario:${u.id}`,
                descricao: `Convite da coordenação reenviado no servidor para ${u.nome_completo}`
            }
        });
        return gravarConvite(u.id, tx, agora);
    });
    await enviarConvite({
        para: u.email,
        nome: u.nome_completo,
        link,
        mostrarLink: args.mostrarLink
    });
}

async function main(argv = process.argv.slice(2), db = prisma, agora = new Date()) {
    const args = lerArgumentos(argv);
    if (args.erro) {
        console.error(args.erro);
        process.exitCode = 2;
        return;
    }
    try {
        await (args.modo === 'reenviar' ? reenviar(args, db, agora) : criar(args, db, agora));
    } catch (erro) {
        console.error(erro.message);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main().finally(() => prisma.$disconnect());
}

module.exports = { lerArgumentos, main, HORAS_CONVITE };
