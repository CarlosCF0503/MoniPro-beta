// R1 (Fase 03): testes de ponta a ponta no navegador, casos CT-01 a CT-11 da Tabela 24.3.
// Rodam contra a pilha descartável de docker-compose.e2e.yml (nunca contra hml ou prod).
//
//   docker compose -f docker-compose.e2e.yml up -d --build --wait
//   npm run test:e2e
//
// Dois projetos, porque Marcar Monitoria e os perfis têm layouts diferentes no computador
// (calendário e lista, abas) e no celular (passo a passo, seções).
const { defineConfig, devices } = require('@playwright/test');

const PORTA = process.env.E2E_PORTA || '8088';

module.exports = defineConfig({
    testDir: './e2e',
    testMatch: '**/*.spec.js',
    fullyParallel: true,
    // Cada teste cria as próprias contas e vagas, então podem rodar em paralelo
    workers: process.env.CI ? 2 : 4,
    retries: process.env.CI ? 1 : 0,
    forbidOnly: Boolean(process.env.CI),
    timeout: 45000,
    expect: { timeout: 8000 },
    reporter: process.env.CI
        ? [['list'], ['html', { open: 'never', outputFolder: 'e2e-relatorio' }]]
        : [['list']],
    outputDir: 'e2e-resultados',
    use: {
        baseURL: `http://localhost:${PORTA}`,
        // O sistema mostra datas no horário de Brasília e em português
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    projects: [
        {
            name: 'computador',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
        },
        { name: 'celular', use: { ...devices['Pixel 7'] } }
    ]
});
