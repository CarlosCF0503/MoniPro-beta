// src/utils/comprovante.js
// Plano 7: o comprovante do pedido de revisão da falta (atestado). Chega em base64 no JSON;
// aqui ele é decodificado e conferido pelo conteúdo, não só pelo tipo que o navegador informou.

const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const ASSINATURAS = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'image/jpeg': [0xff, 0xd8, 0xff]
};
const EXTENSOES = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Nome seguro para mostrar e para o cabeçalho do download: sem caminho, sem caracteres de controle. */
function nomeSeguro(nome, tipo) {
    const base = String(nome || '')
        .split(/[\\/]/)
        .pop()
        .split('')
        // Sem caracteres de controle nem os que quebram nome de arquivo ou cabeçalho
        .filter((c) => c.codePointAt(0) >= 32 && c.codePointAt(0) !== 127 && !'"<>|:*?'.includes(c))
        .join('')
        .trim()
        .slice(0, 120);
    return base || `comprovante.${EXTENSOES[tipo]}`;
}

/**
 * Confere e decodifica. Devolve { nome, tipo, tamanho, conteudo: Buffer } ou { erro }.
 * @param {{ nome?: string, tipo?: string, conteudo?: string }} arquivo
 */
function lerComprovante(arquivo) {
    if (!arquivo || typeof arquivo !== 'object')
        return { erro: 'Anexe o atestado ou outro comprovante.' };
    const { tipo } = arquivo;
    if (!ASSINATURAS[tipo]) return { erro: 'O comprovante precisa ser PDF, JPG ou PNG.' };
    const texto = typeof arquivo.conteudo === 'string' ? arquivo.conteudo.replace(/\s/g, '') : '';
    if (!texto || texto.length % 4 !== 0 || !BASE64.test(texto))
        return { erro: 'Não foi possível ler o arquivo enviado. Tente anexar de novo.' };
    // Confere o tamanho antes de decodificar: 4 caracteres de base64 viram 3 bytes
    if ((texto.length / 4) * 3 > TAMANHO_MAXIMO + 3)
        return { erro: 'O arquivo passa de 5 MB. Envie uma foto com menos resolução ou um PDF.' };
    const conteudo = Buffer.from(texto, 'base64');
    if (conteudo.length > TAMANHO_MAXIMO)
        return { erro: 'O arquivo passa de 5 MB. Envie uma foto com menos resolução ou um PDF.' };
    const assinatura = ASSINATURAS[tipo];
    if (!assinatura.every((b, i) => conteudo[i] === b))
        return { erro: 'O conteúdo do arquivo não é um PDF, JPG ou PNG de verdade.' };
    return { nome: nomeSeguro(arquivo.nome, tipo), tipo, tamanho: conteudo.length, conteudo };
}

module.exports = { lerComprovante, nomeSeguro, TAMANHO_MAXIMO };
