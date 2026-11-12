import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    { ignores: ['dist/**'] },
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            globals: globals.browser,
            parserOptions: { ecmaFeatures: { jsx: true } }
        }
    },
    {
        files: ['*.config.js'],
        languageOptions: { globals: globals.node }
    }
];
