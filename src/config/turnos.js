// src/config/turnos.js
// Plano 13 (RF-017): turnos do filtro de Marcar monitoria, pela hora de início da vaga no fuso
// do campus. Decisão do time (20/11): manhã até 11:59, tarde de 12:00 a 17:59, noite a partir
// das 18:00. "periodo" na API; não confundir com o semestre de src/utils/periodo.js.
const FUSO_TURNOS = 'America/Sao_Paulo';

// [hora inicial (inclusive), hora final (exclusiva)]
const TURNOS = Object.freeze({
    manha: [0, 12],
    tarde: [12, 18],
    noite: [18, 24]
});

module.exports = { FUSO_TURNOS, TURNOS };
