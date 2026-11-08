// src/schemas/disciplinaSchemas.js
// Cadastro de disciplina pelo monitor (Fase 03, item P5).
const { z } = require('zod');
const { textoObrigatorio } = require('./comuns');

const NOME_MINIMO = 3;
const NOME_MAXIMO = 80;

const criarDisciplinaSchema = z.object({
    // O trim tira os espaços das pontas; o transform junta os espaços repetidos do meio,
    // para que "Cálculo   I" e "Cálculo I" sejam a mesma disciplina.
    nome: textoObrigatorio('O nome da disciplina é obrigatório.', NOME_MAXIMO)
        .min(NOME_MINIMO, `O nome da disciplina deve ter pelo menos ${NOME_MINIMO} caracteres.`)
        .transform((nome) => nome.replace(/\s+/g, ' '))
});

module.exports = { criarDisciplinaSchema, NOME_MINIMO, NOME_MAXIMO };
