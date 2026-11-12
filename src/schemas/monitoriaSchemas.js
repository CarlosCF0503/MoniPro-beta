// src/schemas/monitoriaSchemas.js
// Tarefa 9: validação da criação de vaga de monitoria.
const { z } = require('zod');
const { textoObrigatorio, inteiroPositivo, dataHoraIso, INT_MAXIMO } = require('./comuns');

const MENSAGEM_CAPACIDADE = 'A capacidade da vaga deve ser um número inteiro maior ou igual a 1.';

const criarMonitoriaSchema = z.object({
    id_disciplina: inteiroPositivo({
        obrigatorio: 'A disciplina é obrigatória.',
        invalido: 'A disciplina informada é inválida.'
    }),
    horario: dataHoraIso({
        obrigatorio: 'O horário é obrigatório.',
        invalido: 'O horário deve ser uma data/hora ISO 8601 (ex.: 2026-09-10T14:00:00.000Z).'
    }),
    local: textoObrigatorio('O local é obrigatório.', 120),
    descricao: z
        .string('A descrição deve ser um texto.')
        .trim()
        .max(500, 'A descrição deve ter no máximo 500 caracteres.')
        .optional(),
    // Tarefa 23: opcional — sem ela o Prisma aplica @default(1)
    // Aqui não se aceita número em texto ("3"): o frontend envia número JSON
    capacidade: z
        .number(MENSAGEM_CAPACIDADE)
        .int(MENSAGEM_CAPACIDADE)
        .min(1, MENSAGEM_CAPACIDADE)
        .max(INT_MAXIMO, MENSAGEM_CAPACIDADE)
        .optional()
});

// Finalização pelo monitor: só a data/hora de término. A regra "não pode ser anterior ao
// início" depende da vaga no banco e fica em monitoriaService.finalizar.
const finalizarMonitoriaSchema = z.object({
    data_fim: dataHoraIso({
        obrigatorio: 'Informe a data e hora de término da monitoria.',
        invalido:
            'A data de término deve ser uma data/hora ISO 8601 (ex.: 2026-09-10T15:00:00.000Z).'
    })
});

// Editar vaga (RF-009): atualização parcial. Todos os campos são opcionais, mas pelo menos um
// precisa vir. As regras que dependem da vaga no banco (dono, status, janela de 24h, lugares
// >= inscritos) ficam em monitoriaService.atualizar. A disciplina não muda: mudar a disciplina
// é outra vaga.
const atualizarMonitoriaSchema = z
    .object({
        horario: dataHoraIso({
            obrigatorio: 'O horário é obrigatório.',
            invalido: 'O horário deve ser uma data/hora ISO 8601 (ex.: 2026-09-10T14:00:00.000Z).'
        }).optional(),
        local: textoObrigatorio('O local é obrigatório.', 120).optional(),
        descricao: criarMonitoriaSchema.shape.descricao,
        capacidade: criarMonitoriaSchema.shape.capacidade
    })
    .refine((dados) => Object.values(dados).some((valor) => valor !== undefined), {
        message: 'Informe pelo menos um campo para alterar.',
        path: ['corpo']
    });

module.exports = { criarMonitoriaSchema, finalizarMonitoriaSchema, atualizarMonitoriaSchema };
