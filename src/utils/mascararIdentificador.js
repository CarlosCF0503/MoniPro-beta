// src/utils/mascararIdentificador.js
// R6 (LGPD): e-mail e matrícula são dados pessoais e não devem ir inteiros para os logs.
// Mantém só o suficiente para correlacionar tentativas: a primeira letra e o domínio do
// e-mail, ou os dois últimos dígitos da matrícula.

function mascararIdentificador(identificador) {
    const valor = String(identificador ?? '');
    const arroba = valor.indexOf('@');
    if (arroba > 0) {
        return `${valor[0]}***${valor.slice(arroba)}`;
    }
    if (valor.length <= 2) {
        return '***';
    }
    return `***${valor.slice(-2)}`;
}

module.exports = { mascararIdentificador };
