// src/utils/avaliacao.js
// Plano 6 (RF-007, RN-013): o resumo que o monitor vê. Sem id do aluno nem da inscrição, e os
// comentários só com mês e ano. A média só aparece com MINIMO_MEDIA avaliações ou mais.

const MINIMO_MEDIA = 3;
const MAX_COMENTARIOS = 10;
const DESLOCAMENTO_CAMPUS = -3 * 60 * 60 * 1000;

/** "2026-11", no fuso do campus */
function mesDoCampus(data) {
    const local = new Date(new Date(data).getTime() + DESLOCAMENTO_CAMPUS);
    return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Média com uma casa, ou null abaixo do mínimo. */
function media(notas) {
    if (notas.length < MINIMO_MEDIA) return null;
    return Math.round((notas.reduce((t, n) => t + n, 0) / notas.length) * 10) / 10;
}

/**
 * @param {Array<{nota:number, comentario:string|null, criado_em:Date}>} visiveis - só as não
 *   ocultas, da mais nova para a mais antiga
 */
function resumirAvaliacoes(visiveis) {
    const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const a of visiveis) distribuicao[a.nota] += 1;
    return {
        total: visiveis.length,
        media: media(visiveis.map((a) => a.nota)),
        minimo: MINIMO_MEDIA,
        distribuicao,
        comentarios: visiveis
            .filter((a) => a.comentario)
            .slice(0, MAX_COMENTARIOS)
            .map((a) => ({ nota: a.nota, comentario: a.comentario, mes: mesDoCampus(a.criado_em) }))
    };
}

module.exports = { resumirAvaliacoes, media, mesDoCampus, MINIMO_MEDIA };
