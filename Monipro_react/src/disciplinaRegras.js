// Porte de Monipro_web/JS/disciplina/regras.js como módulo ES.
// Regras puras do cadastro de disciplina, iguais às do backend (src/schemas/disciplinaSchemas.js
// e disciplinaService.criar). A tela usa estas regras só para avisar antes do envio; quem decide
// é a API.

export const NOME_MINIMO = 3;
export const NOME_MAXIMO = 80;

// Tira os espaços das pontas e junta os repetidos do meio: "  Cálculo   I " → "Cálculo I"
export function limpar(nome) {
    return String(nome ?? '')
        .trim()
        .replace(/\s+/g, ' ');
}

// Chave de comparação sem diferenciar maiúsculas ("cálculo i" = "Cálculo I").
// Acentos continuam diferenciando, como no backend.
export function chave(nome) {
    return limpar(nome).toLocaleLowerCase('pt-BR');
}

/**
 * Procura na lista uma disciplina com o mesmo nome.
 * @param {Array<{id:number,nome:string}>} lista
 * @param {string} nome
 * @returns {{id:number,nome:string}|null}
 */
export function acharRepetida(lista, nome) {
    const alvo = chave(nome);
    if (!alvo) return null;
    return (lista || []).find((d) => chave(d.nome) === alvo) || null;
}

/**
 * Mesmas mensagens do schema do backend, para o erro não mudar de texto entre a tela e a API.
 * @returns {string|null} mensagem de erro, ou null se o nome é válido
 */
export function validarNome(nome) {
    const limpo = limpar(nome);
    if (!limpo) return 'O nome da disciplina é obrigatório.';
    if (limpo.length < NOME_MINIMO)
        return `O nome da disciplina deve ter pelo menos ${NOME_MINIMO} caracteres.`;
    if (limpo.length > NOME_MAXIMO) return `Deve ter no máximo ${NOME_MAXIMO} caracteres.`;
    return null;
}

export function ordenar(lista) {
    return [...(lista || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
