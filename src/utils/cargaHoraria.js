// src/utils/cargaHoraria.js
// Certificados (RF-005), regra das horas: uma única conta, usada pela elegibilidade, pela
// emissão e pelo número "Horas comprovadas" do perfil.
// - A sessão conta se a vaga foi finalizada (realizada/concluida, com data_fim) e tem pelo
//   menos uma inscrição com presença confirmada pelos dois lados (agendamento concluido).
// - Vale data_fim − horario, no máximo 4h.

const { MINUTOS_MAX_SESSAO } = require('./regrasConclusao');

const FINALIZADAS = ['realizada', 'concluida'];
const ABERTAS = ['ativa', 'pendente'];

/** Minutos que uma sessão vale: entre 0 e 4h. */
function minutosDaSessao(horario, dataFim) {
    const minutos = Math.round((new Date(dataFim) - new Date(horario)) / 60000);
    return Math.min(Math.max(minutos, 0), MINUTOS_MAX_SESSAO);
}

/**
 * Resume as vagas de um monitor num período.
 * @param {Array<{horario:Date, data_fim:Date|null, status:string, disciplina:string,
 *   confirmadas:number}>} vagas - confirmadas = inscrições com presença dos dois lados
 * @param {Date} agora
 * @returns {{minutos:number, sessoes:number, por_disciplina:Array<{disciplina:string,
 *   minutos:number, sessoes:number}>, pendentes:{a_finalizar:number, sem_presenca:number}}}
 */
function resumirCargaHoraria(vagas, agora = new Date()) {
    let minutos = 0;
    let sessoes = 0;
    const porDisciplina = new Map();
    const pendentes = { a_finalizar: 0, sem_presenca: 0 };

    for (const v of vagas) {
        const finalizada = FINALIZADAS.includes(v.status) && v.data_fim;
        if (!finalizada) {
            // O horário passou e o monitor ainda não registrou o término
            if (ABERTAS.includes(v.status) && new Date(v.horario) <= agora)
                pendentes.a_finalizar += 1;
            continue;
        }
        if (!v.confirmadas) {
            pendentes.sem_presenca += 1;
            continue;
        }
        const m = minutosDaSessao(v.horario, v.data_fim);
        minutos += m;
        sessoes += 1;
        const d = porDisciplina.get(v.disciplina) || {
            disciplina: v.disciplina,
            minutos: 0,
            sessoes: 0
        };
        d.minutos += m;
        d.sessoes += 1;
        porDisciplina.set(v.disciplina, d);
    }

    return {
        minutos,
        sessoes,
        por_disciplina: [...porDisciplina.values()].sort((a, b) => b.minutos - a.minutos),
        pendentes
    };
}

module.exports = { minutosDaSessao, resumirCargaHoraria };
