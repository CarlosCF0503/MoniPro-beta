// src/utils/validadores.js

// Letras (incluindo acentuadas), espaços, apóstrofos, hífens e pontos (ex.: "Jr.").
// Bloqueia deliberadamente < > e outros caracteres usados em payloads de HTML/script,
// como defesa em profundidade além do escaping já feito no frontend.
const REGEX_NOME_COMPLETO = /^[\p{L}\p{M} .'-]+$/u;

function validarNomeCompleto(nome) {
    if (typeof nome !== 'string') {
        return { valido: false, erro: 'Nome completo inválido.' };
    }

    const nomeTratado = nome.trim().replace(/\s+/g, ' ');

    if (nomeTratado.length < 3 || nomeTratado.length > 120) {
        return { valido: false, erro: 'Nome completo deve ter entre 3 e 120 caracteres.' };
    }

    if (!REGEX_NOME_COMPLETO.test(nomeTratado)) {
        return {
            valido: false,
            erro: 'Nome completo deve conter apenas letras e espaços.'
        };
    }

    return { valido: true, nome: nomeTratado };
}

module.exports = { validarNomeCompleto };
