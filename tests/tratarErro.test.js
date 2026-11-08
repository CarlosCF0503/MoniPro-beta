// P2002 (registro repetido) nos dois formatos que o Prisma usa
const tratarErro = require('../src/utils/tratarErro');

const doAdaptador = (index) =>
    Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
        meta: {
            driverAdapterError: {
                cause: { kind: 'UniqueConstraintViolation', constraint: { index } }
            }
        }
    });
const semAdaptador = (target) =>
    Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target } });

describe('tratarErro — P2002', () => {
    // O backend usa @prisma/adapter-pg: o campo só aparece pelo nome do índice
    test.each([
        ['disciplinas_nome_key', 'Já existe uma disciplina com este nome.'],
        ['usuarios_email_tipo_usuario_key', 'Este e-mail já está cadastrado.'],
        ['usuarios_matricula_tipo_usuario_key', 'Esta matrícula já está cadastrada.']
    ])('com o adaptador pg, o índice %s vira mensagem específica', (indice, mensagem) => {
        expect(tratarErro(doAdaptador(indice))).toEqual({ statusCode: 409, mensagem });
    });

    test('sem adaptador, continua lendo meta.target', () => {
        expect(tratarErro(semAdaptador(['email'])).mensagem).toBe(
            'Este e-mail já está cadastrado.'
        );
        expect(tratarErro(semAdaptador('disciplinas_nome_key')).mensagem).toBe(
            'Já existe uma disciplina com este nome.'
        );
    });

    test('o adaptador também pode informar os campos da restrição', () => {
        const erro = doAdaptador(undefined);
        erro.meta.driverAdapterError.cause.constraint = { fields: ['matricula', 'tipo_usuario'] };
        expect(tratarErro(erro).mensagem).toBe('Esta matrícula já está cadastrada.');
    });

    test('índice desconhecido ou sem meta: mensagem genérica, ainda 409', () => {
        expect(tratarErro(doAdaptador('outra_tabela_key'))).toEqual({
            statusCode: 409,
            mensagem: 'Registro duplicado. Verifique os dados informados.'
        });
        expect(tratarErro({ code: 'P2002' }).statusCode).toBe(409);
    });
});
