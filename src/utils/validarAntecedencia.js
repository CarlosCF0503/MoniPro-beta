// src/utils/validarAntecedencia.js
// RN-001: Cancelamentos só são permitidos com no mínimo 24h de antecedência
// do horário agendado. Usado por agendamentoService.deletar e monitoriaService.cancelar.

const HORAS_MINIMAS_CANCELAMENTO = 24;

/**
 * Lança um erro claro se a data agendada estiver a menos de `horasMinimas`
 * de distância do momento atual (ou já tiver passado).
 * @param {Date|string} dataAgendada - horário do agendamento/monitoria
 * @param {number} horasMinimas - antecedência mínima exigida, em horas
 */
function validarAntecedenciaCancelamento(dataAgendada, horasMinimas = HORAS_MINIMAS_CANCELAMENTO) {
    const agora = new Date();
    const data = new Date(dataAgendada);

    const diferencaEmHoras = (data.getTime() - agora.getTime()) / (1000 * 60 * 60);

    if (diferencaEmHoras < horasMinimas) {
        throw new Error(
            `Cancelamento não permitido: é necessário cancelar com no mínimo ${horasMinimas}h de antecedência do horário agendado.`
        );
    }
}

module.exports = { validarAntecedenciaCancelamento, HORAS_MINIMAS_CANCELAMENTO };
