// scripts/retencao.js
// R3 (LGPD): aplica os prazos de retenção do Aviso de Privacidade (src/config/retencao.js):
//   - conta sem login há mais de 12 meses: anonimizada (nome, e-mail, matrícula e senha somem);
//   - inscrições e vagas com mais de 2 anos: apagadas (os pontos ficam na conta);
//   - links de redefinição de senha com mais de 24h: apagados (valem só 30 minutos);
//   - contas que não confirmaram o e-mail em 7 dias: apagadas (libera e-mail e matrícula), e os
//     links de confirmação com mais de 7 dias também (valem 48h).
//
// Por padrão só MOSTRA quantos registros seriam afetados. Para aplicar, use --aplicar.
// No servidor, dentro do container do backend (usa o DATABASE_URL e o DB_CA_CERT dele):
//
//   Simular:  docker-compose exec -T backend node scripts/retencao.js
//   Aplicar:  docker-compose exec -T backend node scripts/retencao.js --aplicar
//
// Agendamento sugerido (crontab do servidor, todo dia 1º às 3h), depois da decisão D4:
//   0 3 1 * * cd ~/moni-pro-beta && docker-compose exec -T backend node scripts/retencao.js --aplicar

require('../src/config/env');
const prisma = require('../src/config/bancoDeDados');
const privacidadeService = require('../src/services/privacidadeService');
const {
    MESES_CONTA_PARADA,
    ANOS_HISTORICO,
    HORAS_TOKEN_REDEFINICAO,
    DIAS_CONTA_PENDENTE
} = require('../src/config/retencao');

async function main() {
    const aplicar = process.argv.includes('--aplicar');
    const r = await privacidadeService.aplicarRetencao({ aplicar });
    const verbo = r.aplicado ? '' : ' (simulação, nada foi alterado)';
    console.log(`retenção${verbo}:`);
    console.log(`  contas sem acesso há mais de ${MESES_CONTA_PARADA} meses: ${r.contasParadas}`);
    console.log(`  inscrições com mais de ${ANOS_HISTORICO} anos: ${r.agendamentos}`);
    console.log(`  vagas com mais de ${ANOS_HISTORICO} anos: ${r.vagas}`);
    console.log(
        `  links de redefinição de senha com mais de ${HORAS_TOKEN_REDEFINICAO}h: ${r.tokens}`
    );
    console.log(
        `  contas sem confirmar o e-mail há mais de ${DIAS_CONTA_PENDENTE} dias: ${r.contasPendentes}`
    );
    console.log(
        `  links de confirmação de e-mail com mais de ${DIAS_CONTA_PENDENTE} dias: ${r.tokensConfirmacao}`
    );
    if (!r.aplicado) console.log('Rode de novo com --aplicar para aplicar.');
}

main()
    .catch((erro) => {
        console.error('retenção: falhou —', erro.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
