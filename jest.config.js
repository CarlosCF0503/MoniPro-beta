module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/setupEnv.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setupSessao.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    // R1: os testes de integração usam um PostgreSQL de verdade e rodam à parte, com
    // "npm run test:int" (ver jest.integracao.config.js). O "npm test" continua sem banco.
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/integracao/'],
    // Cobertura ("npm run test:cobertura", que o CI roda em todo PR). Conta todo o src/, não
    // só os arquivos que algum teste importa. O server.js fica de fora: só liga o servidor e
    // é exercitado pelos testes de ponta a ponta. Os repositórios são cobertos sobretudo pelos
    // testes de integração (npm run test:int), que não entram nesta conta.
    collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
    coverageReporters: ['text-summary', 'lcov', 'json-summary'],
    // Piso mínimo, um pouco abaixo do medido em 17/11/2026 (linhas 94%, instruções 93%,
    // ramos 81%, funções 86%): uma queda maior que isso reprova o PR.
    coverageThreshold: {
        global: { lines: 90, statements: 90, branches: 78, functions: 82 }
    }
};
