// R1 (Fase 03): testes de integração contra um PostgreSQL real, num banco descartável.
// O globalSetup recusa qualquer banco que não seja local e chamado *_integracao, apaga o
// schema e aplica as migrações do zero. Rodar com: npm run test:int
// (DATABASE_URL_INTEGRACAO=postgres://usuario:senha@localhost:5432/monipro_integracao) // pragma: allowlist secret
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/integracao/**/*.int.test.js'],
    globalSetup: '<rootDir>/tests/integracao/globalSetup.js',
    setupFiles: ['<rootDir>/tests/integracao/ambiente.js'],
    // Os testes de concorrência abrem várias transações ao mesmo tempo
    testTimeout: 30000,
    // O pool do pg (src/config/bancoDeDados.js) é criado fora do Prisma, então o $disconnect
    // não o fecha e as conexões ociosas seguram o processo por ~10 s depois dos testes
    forceExit: true
};
