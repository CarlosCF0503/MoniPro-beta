// src/schemas/agendamentoSchemas.js
// Tarefa 9: validação da criação de agendamento.
const { z } = require('zod');
const { inteiroPositivo, dataHoraIso } = require('./comuns');

const mensagensData = {
    obrigatorio: 'Informe a data/hora do agendamento.',
    invalido: 'A data/hora deve estar no formato ISO 8601 (ex.: 2026-09-10T14:00:00.000Z).'
};

const criarAgendamentoSchema = z
    .object({
        id_monitoria: inteiroPositivo({
            obrigatorio: 'Selecione uma monitoria antes de agendar.',
            invalido: 'A monitoria selecionada é inválida.'
        }),
        data_hora: dataHoraIso(mensagensData).optional(),
        // Nome antigo do campo, ainda aceito por compatibilidade
        data_agendamento: dataHoraIso(mensagensData).optional()
    })
    .refine((dados) => dados.data_hora || dados.data_agendamento, {
        error: mensagensData.obrigatorio,
        path: ['data_hora']
    });

module.exports = { criarAgendamentoSchema };
