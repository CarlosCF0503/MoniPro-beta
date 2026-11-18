// scripts/certificados.js
// Certificados (RF-005), PR 5: revoga uma declaração de horas pelo código. Enquanto não existe
// o perfil Administrador, esta é a única forma de revogar; depois, o script fica só para
// emergências. Grava a data, o motivo e uma linha no log.
//
// Por padrão só MOSTRA o que faria. Para aplicar, use --aplicar.
// No servidor, dentro do container do backend (usa o DATABASE_URL e o DB_CA_CERT dele):
//
//   Simular:  docker-compose exec -T backend node scripts/certificados.js --revogar CODIGO --motivo "..."
//   Aplicar:  docker-compose exec -T backend node scripts/certificados.js --revogar CODIGO --motivo "..." --aplicar
//
// O código pode ter hífens ou espaços, como aparece impresso na declaração.

require('../src/config/env');
const prisma = require('../src/config/bancoDeDados');
const certificadoService = require('../src/services/certificadoService');
const { nomeDoPeriodo } = require('../src/utils/periodo');

const USO = 'uso: node scripts/certificados.js --revogar CODIGO --motivo "por que" [--aplicar]';

/** Lê --revogar, --motivo e --aplicar. Devolve null se faltar algo. */
function lerArgumentos(argv) {
    const valor = (nome) => {
        const i = argv.indexOf(nome);
        return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
    };
    const codigo = valor('--revogar');
    const motivo = valor('--motivo');
    if (!codigo || !motivo) return null;
    return { codigo, motivo, aplicar: argv.includes('--aplicar') };
}

function horas(minutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

const horarioDeBrasilia = (data) =>
    data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)';

async function main(argv = process.argv.slice(2)) {
    const args = lerArgumentos(argv);
    if (!args) {
        console.error(USO);
        process.exitCode = 2;
        return;
    }
    const r = await certificadoService.revogar(args.codigo, args.motivo, {
        aplicar: args.aplicar
    });
    const d = r.declaracao;
    console.log(r.aplicado ? 'declaração revogada:' : 'revogação (simulação, nada foi alterado):');
    console.log(`  titular: ${d.nome}`);
    console.log(`  semestre: ${nomeDoPeriodo(d.periodo)}`);
    console.log(`  carga horária: ${horas(d.carga_minutos)}`);
    console.log(`  emitida em: ${horarioDeBrasilia(d.emitido_em)}`);
    console.log(`  situação: ${d.situacao}`);
    console.log(`  motivo: ${r.motivo}`);
    if (!r.aplicado) console.log('Rode de novo com --aplicar para revogar.');
}

if (require.main === module) {
    main()
        .catch((erro) => {
            console.error('certificados: falhou —', erro.message);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

module.exports = { lerArgumentos, main };
