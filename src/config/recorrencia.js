// src/config/recorrencia.js
// Plano 9 (RF-014): vaga que se repete toda semana até uma data. Decisão do time (21/11): só
// semanal e no máximo 16 vagas por vez (um semestre).
const MAX_OCORRENCIAS = 16;
const DIAS_ENTRE_OCORRENCIAS = 7;

module.exports = { MAX_OCORRENCIAS, DIAS_ENTRE_OCORRENCIAS };
