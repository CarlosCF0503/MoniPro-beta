// src/utils/semelhancaDisciplina.js
// Plano 7: ao revisar uma disciplina criada por monitor, o painel sugere a aprovada mais
// parecida ("Calculo 1" -> "Cálculo I"), para a coordenação mesclar em vez de duplicar.

const ROMANOS = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };
const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o']);

/** Forma comparável: sem acento, minúscula, números romanos viram arábicos, sem plural. */
function normalizar(nome) {
    return String(nome)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter((p) => p && !PALAVRAS_VAZIAS.has(p))
        .map((p) => ROMANOS[p] || (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p))
        .join(' ');
}

/** Distância de edição (inserir, apagar ou trocar uma letra). */
function distancia(a, b) {
    let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const atual = [i];
        for (let j = 1; j <= b.length; j++) {
            atual[j] = Math.min(
                anterior[j] + 1,
                atual[j - 1] + 1,
                anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        anterior = atual;
    }
    return anterior[b.length];
}

const numeros = (normalizado) => (normalizado.match(/\d+/g) || []).join(' ');

/**
 * A disciplina mais parecida entre as candidatas, ou null. Conta como parecida quando os
 * nomes normalizados são iguais ou diferem em até 1 letra a cada 6 (no máximo 3), com os
 * mesmos números (I, II, 1, 2...).
 * @param {string} nome
 * @param {Array<{id:number, nome:string}>} candidatas
 */
function maisParecida(nome, candidatas) {
    const alvo = normalizar(nome);
    const limite = Math.min(3, Math.floor(alvo.length / 6));
    const numerosAlvo = numeros(alvo);
    let melhor = null;
    for (const c of candidatas) {
        const outro = normalizar(c.nome);
        // Cálculo I e Cálculo II são matérias diferentes, mesmo com uma letra de diferença
        if (numeros(outro) !== numerosAlvo) continue;
        const d = distancia(alvo, outro);
        if (d <= limite && (!melhor || d < melhor.d)) melhor = { d, c };
    }
    return melhor ? { id: melhor.c.id, nome: melhor.c.nome } : null;
}

module.exports = { normalizar, distancia, maisParecida };
