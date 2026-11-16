// src/config/certificados.js
// Certificados (RF-005, decisão D-C1): carga mínima para emitir a declaração de horas.
// CERT_MINIMO_MINUTOS no .env muda o valor; ausente ou inválido = 60 (1h).

const PADRAO_MINIMO_MINUTOS = 60;

function minimoMinutosCertificado(env = process.env) {
    const valor = Number(env.CERT_MINIMO_MINUTOS);
    return Number.isInteger(valor) && valor > 0 ? valor : PADRAO_MINIMO_MINUTOS;
}

module.exports = { minimoMinutosCertificado };
