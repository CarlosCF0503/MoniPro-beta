// src/schemas/monitoriaSchemas.js
// Tarefa 9: validação da criação de vaga de monitoria.
const { z } = require('zod');
const { textoObrigatorio, inteiroPositivo, dataHoraIso, INT_MAXIMO } = require('./comuns');
const { MINUTOS_TOLERANCIA_RELOGIO } = require('../utils/regrasConclusao');
const { normalizarLinkSala, MENSAGEM_LINK_SALA } = require('../utils/linkSala');
const { TURNOS } = require('../config/turnos');

const MENSAGEM_CAPACIDADE = 'A capacidade da vaga deve ser um número inteiro maior ou igual a 1.';

// Plano 11: presencial (padrão) ou on-line
const modalidade = z.enum(['presencial', 'online'], 'A modalidade deve ser presencial ou on-line.');
// Link da sala: só Meet, Teams, Zoom e Jitsi, em https; sai normalizado
const linkSala = z.string('O link da sala deve ser um texto.').transform((valor, ctx) => {
    const link = normalizarLinkSala(valor);
    if (!link) {
        ctx.addIssue({ code: 'custom', message: MENSAGEM_LINK_SALA });
        return z.NEVER;
    }
    return link;
});
const LOCAL_ONLINE = 'On-line';

const camposCriar = z.object({
    id_disciplina: inteiroPositivo({
        obrigatorio: 'A disciplina é obrigatória.',
        invalido: 'A disciplina informada é inválida.'
    }),
    // R14: vaga só no futuro. Sem isso, duas contas combinadas criariam uma sessão já
    // "realizada" e forjariam pontos e horas de certificado. A conta é feita a cada pedido.
    horario: dataHoraIso({
        obrigatorio: 'O horário é obrigatório.',
        invalido: 'O horário deve ser uma data/hora ISO 8601 (ex.: 2026-09-10T14:00:00.000Z).'
    }).refine(
        (valor) => new Date(valor).getTime() > Date.now() - MINUTOS_TOLERANCIA_RELOGIO * 60000,
        'Escolha um dia e horário que ainda não passaram.'
    ),
    // Obrigatório na presencial; na on-line o local vira "On-line" (ver o refinamento abaixo)
    local: textoObrigatorio('O local é obrigatório.', 120).optional(),
    modalidade: modalidade.optional(),
    link: linkSala.optional(),
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

// Presencial: local obrigatório e sem link. On-line: link obrigatório; o local é "On-line".
const criarMonitoriaSchema = camposCriar
    .superRefine((dados, ctx) => {
        if (dados.modalidade === 'online') {
            if (!dados.link)
                ctx.addIssue({
                    code: 'custom',
                    path: ['link'],
                    message: 'Informe o link da sala.'
                });
            return;
        }
        if (!dados.local)
            ctx.addIssue({ code: 'custom', path: ['local'], message: 'O local é obrigatório.' });
        if (dados.link)
            ctx.addIssue({
                code: 'custom',
                path: ['link'],
                message: 'Vaga presencial não tem link de sala.'
            });
    })
    .transform((dados) =>
        dados.modalidade === 'online'
            ? { ...dados, local: LOCAL_ONLINE }
            : { ...dados, modalidade: 'presencial' }
    );

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
        // Plano 11: a combinação com a modalidade atual da vaga é conferida no service
        modalidade: modalidade.optional(),
        link: linkSala.optional(),
        descricao: camposCriar.shape.descricao,
        capacidade: camposCriar.shape.capacidade
    })
    .refine((dados) => Object.values(dados).some((valor) => valor !== undefined), {
        message: 'Informe pelo menos um campo para alterar.',
        path: ['corpo']
    });

// Plano 13 (RF-017): filtros opcionais da listagem por disciplina (query string). Monitor que
// não existe não é erro: só não traz nenhuma vaga.
const filtrosListagemSchema = z.object({
    periodo: z.enum(Object.keys(TURNOS), 'O período deve ser manha, tarde ou noite.').optional(),
    monitor: inteiroPositivo({
        obrigatorio: 'O monitor é obrigatório.',
        invalido: 'O monitor informado é inválido.'
    }).optional(),
    livres: z
        .enum(['1', 'true', '0', 'false'], 'Use livres=1 para só vagas com lugar.')
        .optional()
        .transform((v) => v === '1' || v === 'true')
});

module.exports = {
    filtrosListagemSchema,
    criarMonitoriaSchema,
    finalizarMonitoriaSchema,
    atualizarMonitoriaSchema,
    LOCAL_ONLINE
};
