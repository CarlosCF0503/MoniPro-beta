const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'prisma/migrations/**',
            'Monipro_web/Dockerfile',
            '**/*.min.js',
            // Evidências de teste: registros fixos, guardados como foram executados
            'docs/evidencias/**',
            // Saídas do Playwright (R1)
            'e2e-resultados/**',
            'e2e-relatorio/**',
            // Relatório de cobertura (npm run test:cobertura)
            'coverage/**'
        ]
    },
    js.configs.recommended,
    {
        files: ['src/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', 'prisma/*.js', '*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        }
    },
    {
        // R1: testes de ponta a ponta (Playwright). Rodam no Node, mas o código passado a
        // page.evaluate() roda no navegador (window, fetch).
        files: ['e2e/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node, ...globals.browser }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        }
    },
    {
        // O front usa ES modules: cada arquivo importa o que usa de outro (import/export),
        // então o ESLint confere os nomes sem uma lista de globais compartilhadas.
        files: ['Monipro_web/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: globals.browser
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        }
    },
    {
        // JS/config.js é gerado no servidor a partir do template (envsubst) e carregado como
        // script comum, antes dos módulos: só define window.MONIPRO_CONFIG.
        files: ['Monipro_web/JS/config.js'],
        languageOptions: { sourceType: 'script' }
    },
    prettier
];
