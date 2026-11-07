// src/schemas/agendamentoSchemas.js
// Tarefa 9: validação da criação de agendamento.
const { z } = require('zod');
const { inteiroPositivo, dataHoraIso } = require('./comuns');

const mensagensData = {
    obrigatorio: 'Informe a data/hora do agendamento.',
    invalido: 'A data/hora deve estar no formato ISO 8601 (ex.: 2026-09-10T14:00:00.000Z).'
};

// Tarefa 31: data_hora/data_agendamento continuam aceitos (o frontend ainda os envia), mas são
// ignorados — o service grava o horário da própria vaga. Por isso deixaram de ser obrigatórios.
const criarAgendamentoSchema = z.object({
    id_monitoria: inteiroPositivo({
        obrigatorio: 'Selecione uma monitoria antes de agendar.',
        invalido: 'A monitoria selecionada é inválida.'
    }),
    data_hora: dataHoraIso(mensagensData).optional(),
    // Nome antigo do campo, ainda aceito por compatibilidade
    data_agendamento: dataHoraIso(mensagensData).optional()
});

module.exports = { criarAgendamentoSchema };
