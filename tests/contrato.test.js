const fs = require('fs');
const path = require('path');

// Guarda do contrato de resposta documentado em docs/openapi.yaml:
// toda resposta de erro da API usa { success: false, erro: '<mensagem>' }.
//
// Esta divergência já aconteceu uma vez: o disciplinaController respondia
// { erro: true, mensagem: '...' }, então um cliente que lia `data.erro` como
// string recebia o booleano `true`. O teste é estático (lê o fonte) porque o
// objetivo é falhar no code review/CI, antes de a rota existir em produção.

const DIR_CONTROLLERS = path.join(__dirname, '..', 'src', 'controllers');
const DIR_MIDDLEWARES = path.join(__dirname, '..', 'src', 'middlewares');

function arquivosJs(diretorio) {
    return fs
        .readdirSync(diretorio)
        .filter((arquivo) => arquivo.endsWith('.js'))
        .map((arquivo) => [arquivo, fs.readFileSync(path.join(diretorio, arquivo), 'utf8')]);
}

const fontes = [...arquivosJs(DIR_CONTROLLERS), ...arquivosJs(DIR_MIDDLEWARES)];

describe('Contrato de resposta da API', () => {
    it.each(fontes)('%s não usa a chave `erro` como booleano', (_arquivo, codigo) => {
        expect(codigo).not.toMatch(/erro\s*:\s*(true|false)\b/);
    });

    it.each(fontes)('%s não usa `mensagem` para descrever uma falha', (_arquivo, codigo) => {
        // `mensagem` é reservado para respostas de sucesso ({ success: true, mensagem: '...' }).
        // Em falhas, a mensagem vai em `erro`.
        const trechosDeErro = codigo.match(/status\((?:4|5)\d\d\)\.json\(\{[^}]*\}/gs) || [];
        for (const trecho of trechosDeErro) {
            expect(trecho).not.toMatch(/\bmensagem\s*:/);
        }
    });
});
