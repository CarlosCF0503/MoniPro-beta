// JS/disciplina/regras.js
// Regras puras do cadastro de disciplina, iguais às do backend (src/schemas/disciplinaSchemas.js
// e disciplinaService.criar). Não tocam no DOM, então rodam no navegador (global
// DisciplinaRegras) e no Jest (module.exports) — ver tests/disciplinaRegras.test.js.
// A tela usa estas regras só para avisar antes do envio; quem decide é a API.
/* global module */

(function (raiz) {
    const NOME_MINIMO = 3;
    const NOME_MAXIMO = 80;

    // Tira os espaços das pontas e junta os repetidos do meio: "  Cálculo   I " → "Cálculo I"
    function limpar(nome) {
        return String(nome ?? '')
            .trim()
            .replace(/\s+/g, ' ');
    }

    // Chave de comparação sem diferenciar maiúsculas ("cálculo i" = "Cálculo I").
    // Acentos continuam diferenciando, como no backend.
    function chave(nome) {
        return limpar(nome).toLocaleLowerCase('pt-BR');
    }

    /**
     * Procura na lista uma disciplina com o mesmo nome.
     * @param {Array<{id:number,nome:string}>} lista
     * @param {string} nome
     * @returns {{id:number,nome:string}|null}
     */
    function acharRepetida(lista, nome) {
        const alvo = chave(nome);
        if (!alvo) return null;
        return (lista || []).find((d) => chave(d.nome) === alvo) || null;
    }

    /**
     * Mesmas mensagens do schema do backend, para o erro não mudar de texto entre a tela e a API.
     * @returns {string|null} mensagem de erro, ou null se o nome é válido
     */
    function validarNome(nome) {
        const limpo = limpar(nome);
        if (!limpo) return 'O nome da disciplina é obrigatório.';
        if (limpo.length < NOME_MINIMO)
            return `O nome da disciplina deve ter pelo menos ${NOME_MINIMO} caracteres.`;
        if (limpo.length > NOME_MAXIMO) return `Deve ter no máximo ${NOME_MAXIMO} caracteres.`;
        return null;
    }

    function ordenar(lista) {
        return [...(lista || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    // Leitura do perfil no token (só para decidir o que mostrar; quem barra é o 403 da API)
    function perfilDoToken(token) {
        try {
            const dados = JSON.parse(atob(String(token).split('.')[1]));
            return String(dados.tipo || dados.tipo_usuario || '').toLowerCase() || null;
        } catch {
            return null;
        }
    }

    const api = {
        NOME_MINIMO,
        NOME_MAXIMO,
        limpar,
        chave,
        acharRepetida,
        validarNome,
        ordenar,
        perfilDoToken
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.DisciplinaRegras = api;
})(typeof window !== 'undefined' ? window : this);
