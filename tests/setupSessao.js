// P3 (R7): o middleware de autenticação confere a versão da sessão no banco a cada requisição.
// Os testes de rota mockam o Prisma com formatos diferentes, então a consulta da versão é
// mockada aqui para todos: por padrão a versão atual é 0, a mesma dos tokens de helpers/token.js.
// Os testes de revogação (tests/sessao.test.js) trocam o retorno por teste.
jest.mock('../src/repositories/sessaoRepository', () => ({
    buscarVersao: jest.fn().mockResolvedValue(0),
    incrementarVersao: jest.fn().mockResolvedValue(undefined)
}));
