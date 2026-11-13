// prisma/seed.js
// Dados fictícios para homologação (dev.moni-pro.app.br) e para bancos locais.
// Usado pelo teste manual, pela avaliação de usabilidade (R2) e pelos testes E2E (R1).
//
// Uso:  SEED_AMBIENTE=hml SEED_SENHA='...' npm run seed
//
// Proteções contra rodar em produção:
//   1. SEED_AMBIENTE precisa ser "hml" ou "local".
//   2. Se o banco já tiver usuários que não são fictícios (como em produção), o seed para.
//      Em hml com contas criadas à mão pela equipe, confirmar com SEED_IGNORAR_USUARIOS_REAIS=sim.
//
// Pode rodar de novo: usuários e disciplinas são atualizados (upsert) e as vagas dos
// monitores fictícios são recriadas com datas a partir de hoje.

const bcrypt = require('bcryptjs');

const DOMINIO = '@ficticio.invalid';
const PREFIXO = '[FICTÍCIO]';
const AMBIENTES = ['hml', 'local'];

const DISCIPLINAS = [
    'Algoritmos',
    'Cálculo I',
    'Banco de Dados',
    'Estruturas de Dados',
    'Engenharia de Software'
];

const MONITORES = [
    { nome: 'Ana Ribeiro', email: 'monitor1', matricula: 990001, disciplinas: [0, 3] },
    { nome: 'Bruno Lima', email: 'monitor2', matricula: 990002, disciplinas: [1] },
    { nome: 'Carla Souza', email: 'monitor3', matricula: 990003, disciplinas: [2, 4] }
];

const ALUNOS = [
    { nome: 'Diego Martins', email: 'aluno1', matricula: 991001 },
    { nome: 'Elisa Costa', email: 'aluno2', matricula: 991002 },
    { nome: 'Felipe Rocha', email: 'aluno3', matricula: 991003 },
    { nome: 'Gabriela Alves', email: 'aluno4', matricula: 991004 },
    { nome: 'Heitor Nunes', email: 'aluno5', matricula: 991005 }
];

const LOCAIS = [
    'Bloco A, sala 12',
    'Biblioteca, sala de estudos 2',
    'Laboratório 3',
    'Online (Meet)'
];

function falhar(mensagem) {
    console.error(`seed: ${mensagem}`);
    process.exit(1);
}

// Horário de Brasília (UTC-3, sem horário de verão) em "dias" a partir de hoje.
function horario(dias, hora) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + dias);
    d.setUTCHours(hora + 3, 0, 0, 0);
    return d;
}

async function main() {
    const ambiente = process.env.SEED_AMBIENTE;
    if (!AMBIENTES.includes(ambiente)) {
        falhar(
            `defina SEED_AMBIENTE como ${AMBIENTES.join(' ou ')}. Este seed nunca roda em produção.`
        );
    }
    const senha = process.env.SEED_SENHA;
    if (!senha || senha.length < 8) {
        falhar('defina SEED_SENHA (8 caracteres ou mais) com a senha das contas fictícias.');
    }

    const prisma = require('../src/config/bancoDeDados');

    try {
        const reais = await prisma.usuario.count({
            where: { NOT: { email: { endsWith: DOMINIO } } }
        });
        if (reais > 0 && process.env.SEED_IGNORAR_USUARIOS_REAIS !== 'sim') {
            falhar(
                `o banco tem ${reais} usuário(s) que não são fictícios. Se for produção, pare aqui. ` +
                    'Se for hml com contas da equipe, rode de novo com SEED_IGNORAR_USUARIOS_REAIS=sim.'
            );
        }

        const hash = await bcrypt.hash(senha, 10);

        const disciplinas = [];
        for (const nome of DISCIPLINAS) {
            disciplinas.push(
                await prisma.disciplina.upsert({ where: { nome }, update: {}, create: { nome } })
            );
        }

        async function salvarUsuario(pessoa, tipo) {
            const email = `${pessoa.email}${DOMINIO}`;
            const dados = {
                nome_completo: `${PREFIXO} ${pessoa.nome}`,
                senha: hash,
                matricula: pessoa.matricula,
                // Plano 14: as contas fictícias entram sem precisar abrir o link de confirmação
                email_confirmado_em: new Date()
            };
            return prisma.usuario.upsert({
                where: { email_tipo_usuario: { email, tipo_usuario: tipo } },
                update: { ...dados, pontos: 0 },
                create: { ...dados, email, tipo_usuario: tipo }
            });
        }

        const monitores = [];
        for (const m of MONITORES)
            monitores.push({ ...m, registro: await salvarUsuario(m, 'monitor') });
        const alunos = [];
        for (const a of ALUNOS) alunos.push(await salvarUsuario(a, 'aluno'));

        // Recria as vagas dos monitores fictícios para que as datas fiquem sempre a partir de hoje.
        const idsMonitores = monitores.map((m) => m.registro.id);
        await prisma.$transaction([
            prisma.agendamento.deleteMany({
                where: { monitoria: { id_monitor: { in: idsMonitores } } }
            }),
            prisma.monitoria.deleteMany({ where: { id_monitor: { in: idsMonitores } } })
        ]);

        let vagas = 0;
        let inscricoes = 0;
        for (const [i, m] of monitores.entries()) {
            for (const [j, idx] of m.disciplinas.entries()) {
                const base = { id_monitor: m.registro.id, id_disciplina: disciplinas[idx].id };
                const local = LOCAIS[(i + j) % LOCAIS.length];

                // Uma vaga já passada e finalizada pelo monitor, com um inscrito: serve para o
                // histórico (RF-004) e para a confirmação de presença pelo monitor (P2).
                // Fica "realizada" porque a listagem de vagas mostra toda vaga "ativa", até as passadas.
                const inicio = horario(-2 - i, 14 + j);
                const passada = await prisma.monitoria.create({
                    data: {
                        ...base,
                        horario: inicio,
                        data_fim: new Date(inicio.getTime() + 60 * 60 * 1000),
                        status: 'realizada',
                        local,
                        capacidade: 2
                    }
                });
                await prisma.agendamento.create({
                    data: {
                        id_monitoria: passada.id,
                        id_aluno: alunos[(i + j) % alunos.length].id,
                        data_hora: passada.horario
                    }
                });
                vagas++;
                inscricoes++;

                // Vagas futuras nas próximas duas semanas, com capacidades diferentes.
                for (const dias of [1 + i, 3 + i, 8 + i, 12 + i]) {
                    await prisma.monitoria.create({
                        data: {
                            ...base,
                            horario: horario(dias, 9 + ((dias + j) % 4) * 3),
                            local,
                            descricao: 'Revisão de exercícios e dúvidas da lista',
                            capacidade: 1 + (dias % 3)
                        }
                    });
                    vagas++;
                }
            }
        }

        console.log(
            `seed (${ambiente}): ${disciplinas.length} disciplinas, ${monitores.length} monitores, ` +
                `${alunos.length} alunos, ${vagas} vagas e ${inscricoes} inscrições. ` +
                `Contas: monitor1..3${DOMINIO} e aluno1..5${DOMINIO}.`
        );
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((erro) => {
    console.error(erro);
    process.exit(1);
});
