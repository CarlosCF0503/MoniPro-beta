module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/setupEnv.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setupSessao.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js']
};
