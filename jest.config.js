module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/setupEnv.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setupSessao.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    // R1: os testes de integração usam um PostgreSQL de verdade e rodam à parte, com
    // "npm run test:int" (ver jest.integracao.config.js). O "npm test" continua sem banco.
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/integracao/']
};
