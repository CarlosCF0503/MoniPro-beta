const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'prisma/migrations/**',
            'Monipro_web/Dockerfile',
            '**/*.min.js'
        ]
    },
    js.configs.recommended,
    {
        files: ['src/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', '*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
        }
    },
    {
        // Múltiplos <script> não-modulares compartilham o mesmo escopo global no navegador.
        // Estas funções são definidas em um arquivo (toast.js, api.js, calendario.js) e
        // consumidas em outros, então precisam ser declaradas aqui para o ESLint enxergá-las.
        files: ['Monipro_web/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                showToast: 'readonly',
                chamadaApi: 'readonly',
                MB_BETA_ORM: 'readonly',
                renderCalendario: 'readonly',
                iniciarNavegacaoCalendario: 'readonly',
                selecionarDia: 'readonly',
                getTdSelecionado: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            // Os próprios arquivos que definem showToast/chamadaApi/MB_BETA_ORM colidem
            // com a declaração desses nomes como globais (necessária para os arquivos que
            // os consomem) — comportamento esperado neste padrão de múltiplos <script>.
            'no-redeclare': 'off'
        }
    },
    prettier
];
