// Regras puras da tela "Nova disciplina" (Monipro_web/JS/disciplina/regras.js)
const R = require('../Monipro_web/JS/disciplina/regras.js');
const { criarDisciplinaSchema } = require('../src/schemas/disciplinaSchemas');

const LISTA = [
    { id: 1, nome: 'Cálculo I' },
    { id: 2, nome: 'Algoritmos' },
    { id: 3, nome: 'Álgebra Linear' }
];

describe('cadastro de disciplina — regras da tela', () => {
    test('limpar tira os espaços das pontas e junta os repetidos', () => {
        expect(R.limpar('  Estruturas   de  Dados ')).toBe('Estruturas de Dados');
        expect(R.limpar(undefined)).toBe('');
    });

    test('acharRepetida compara sem diferenciar maiúsculas nem espaços sobrando', () => {
        expect(R.acharRepetida(LISTA, 'cálculo i')).toEqual({ id: 1, nome: 'Cálculo I' });
        expect(R.acharRepetida(LISTA, '  CÁLCULO   I ')).toEqual({ id: 1, nome: 'Cálculo I' });
        expect(R.acharRepetida(LISTA, 'Cálculo II')).toBeNull();
        expect(R.acharRepetida(LISTA, '   ')).toBeNull();
        expect(R.acharRepetida(undefined, 'Cálculo I')).toBeNull();
    });

    test('acentos continuam diferenciando, como no backend', () => {
        expect(R.acharRepetida(LISTA, 'Calculo I')).toBeNull();
    });

    test('ordenar segue a ordem alfabética do português, sem alterar a lista original', () => {
        const ordenada = R.ordenar(LISTA);
        expect(ordenada.map((d) => d.id)).toEqual([3, 2, 1]);
        expect(LISTA.map((d) => d.id)).toEqual([1, 2, 3]);
    });

    test('perfilDoToken lê o tipo do JWT e devolve null para token inválido', () => {
        const corpo = Buffer.from(JSON.stringify({ id: 1, tipo: 'monitor' })).toString('base64');
        expect(R.perfilDoToken(`x.${corpo}.y`)).toBe('monitor');
        expect(R.perfilDoToken('lixo')).toBeNull();
        expect(R.perfilDoToken(null)).toBeNull();
    });

    // A tela avisa antes de enviar com as mesmas mensagens que a API devolveria
    test.each([
        ['', 'O nome da disciplina é obrigatório.'],
        ['    ', 'O nome da disciplina é obrigatório.'],
        ['IA', 'O nome da disciplina deve ter pelo menos 3 caracteres.'],
        ['x'.repeat(81), 'Deve ter no máximo 80 caracteres.'],
        ['Cálculo I', null],
        ['x'.repeat(80), null]
    ])('validarNome(%j) dá o mesmo resultado que o schema do backend', (nome, esperado) => {
        expect(R.validarNome(nome)).toBe(esperado);

        const backend = criarDisciplinaSchema.safeParse({ nome });
        expect(backend.success).toBe(esperado === null);
        if (!backend.success) expect(backend.error.issues[0].message).toBe(esperado);
    });
});
