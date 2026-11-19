// src/utils/statusInscricao.js
// Plano 8: quais inscrições ocupam lugar na vaga. Cancelada não ocupa, e quem está na lista de
// espera (em_espera) também não. Toda contagem de lugares usa este filtro.

const NAO_OCUPAM_LUGAR = ['cancelado', 'em_espera'];
const OCUPA_LUGAR = { status: { notIn: NAO_OCUPAM_LUGAR } };
const NA_FILA = { status: 'em_espera' };

module.exports = { NAO_OCUPAM_LUGAR, OCUPA_LUGAR, NA_FILA };
