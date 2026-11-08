// src/utils/regrasConclusao.js
// P2 (R4) e decisão D1 da Fase 03: a presença do aluno é confirmada pelo monitor dono da vaga,
// só depois do horário da sessão e em até 7 dias. Cada confirmação credita pontos aos dois.

const { ErroRegraNegocio } = require('./erros');

const PONTOS_MONITOR = 10;
const PONTOS_ALUNO = 2;
const DIAS_PRAZO_CONFIRMACAO = 7;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// O servidor roda em UTC; a mensagem mostra o horário como o usuário o vê na tela.
function formatarDataHora(data) {
    return new Date(data).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Lança ErroRegraNegocio se a sessão ainda não começou ou se o prazo de confirmação passou.
 * @param {Date|string} horario - horário da vaga (monitoria.horario)
 * @param {Date} agora
 */
function validarJanelaConfirmacao(horario, agora = new Date()) {
    const inicio = new Date(horario);
    if (agora < inicio) {
        throw new ErroRegraNegocio(
            `A presença só pode ser confirmada depois do horário da sessão (${formatarDataHora(inicio)}).`
        );
    }
    const limite = new Date(inicio.getTime() + DIAS_PRAZO_CONFIRMACAO * MS_POR_DIA);
    if (agora > limite) {
        throw new ErroRegraNegocio(
            `O prazo para confirmar a presença terminou: ${DIAS_PRAZO_CONFIRMACAO} dias depois da sessão (${formatarDataHora(limite)}).`
        );
    }
}

module.exports = {
    PONTOS_MONITOR,
    PONTOS_ALUNO,
    DIAS_PRAZO_CONFIRMACAO,
    validarJanelaConfirmacao
};
