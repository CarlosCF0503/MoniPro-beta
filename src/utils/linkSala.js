// src/utils/linkSala.js
// Plano 11 (RF-016): link da sala de uma monitoria on-line. Só https e só das ferramentas que a
// instituição usa (decisão de 19/11): Google Meet, Microsoft Teams, Zoom e Jitsi. Um link de
// outro site (encurtador, página falsa) é recusado. Para aceitar outra ferramenta, basta
// acrescentar o domínio aqui.

const DOMINIOS_ACEITOS = [
    'meet.google.com',
    'teams.microsoft.com',
    'teams.live.com',
    'zoom.us',
    'meet.jit.si'
];
const TAMANHO_MAXIMO = 500;

const MENSAGEM =
    'Use o link da sala do Google Meet, Microsoft Teams, Zoom ou Jitsi, começando com https://.';

/** Devolve o link normalizado, ou null se não for de uma sala aceita. */
function normalizarLinkSala(texto) {
    const bruto = String(texto ?? '').trim();
    if (!bruto || bruto.length > TAMANHO_MAXIMO) return null;
    let url;
    try {
        url = new URL(bruto);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const aceito = DOMINIOS_ACEITOS.some((d) => host === d || host.endsWith('.' + d));
    return aceito ? url.toString() : null;
}

module.exports = { normalizarLinkSala, DOMINIOS_ACEITOS, MENSAGEM_LINK_SALA: MENSAGEM };
