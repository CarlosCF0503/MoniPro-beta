// Limites de requisições configuráveis (src/config/limites.js): os padrões de produção só
// mudam com um inteiro positivo explícito, usado pela pilha dos testes E2E.
const { limiteTentativasAuth, limiteRequisicoesPorMinuto } = require('../src/config/limites');

describe('limites de requisições por IP', () => {
    it.each([undefined, '', 'abc', '0', '-5', '2.5'])(
        'com %p usa os padrões (10 em /auth e 120 por minuto)',
        (valor) => {
            const env = { LIMITE_TENTATIVAS_AUTH: valor, LIMITE_REQUISICOES_MINUTO: valor };
            expect(limiteTentativasAuth(env)).toBe(10);
            expect(limiteRequisicoesPorMinuto(env)).toBe(120);
        }
    );

    it('aceita um inteiro positivo explícito', () => {
        const env = { LIMITE_TENTATIVAS_AUTH: '1000', LIMITE_REQUISICOES_MINUTO: '5000' };
        expect(limiteTentativasAuth(env)).toBe(1000);
        expect(limiteRequisicoesPorMinuto(env)).toBe(5000);
    });

    it('sem variáveis de ambiente, mantém os padrões', () => {
        expect(limiteTentativasAuth({})).toBe(10);
        expect(limiteRequisicoesPorMinuto({})).toBe(120);
    });
});
