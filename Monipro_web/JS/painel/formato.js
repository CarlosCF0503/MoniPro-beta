// JS/painel/formato.js
// Plano 7: formatação (horas, porcentagem, datas no fuso de Brasília) e ícones do painel da
// coordenação. Funções puras, sem estado nem DOM, usadas por JS/painel.js, JS/painel/indicadores.js e JS/painel/abas.js.

const horas = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? h + 'h' + String(m).padStart(2, '0') : h + 'h';
};
const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
const milhar = (n) => n.toLocaleString('pt-BR');
const FUSO = { timeZone: 'America/Sao_Paulo' };
const dataCurta = (iso) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', ...FUSO });
const dataHora = (iso) =>
    new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...FUSO
    });
const ico = (d, t = 20) =>
    '<svg class="ico" width="' +
    t +
    '" height="' +
    t +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    d +
    '</svg>';
const ICO = {
    cert: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="m9 15 2 2 4-4"/>',
    livro: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    alerta: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    bloqueio:
        '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    pena: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    juntar: '<path d="M8 3v5a4 4 0 0 0 4 4h0a4 4 0 0 1 4 4v5"/><path d="M16 3v5a4 4 0 0 1-4 4"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>'
};
const presencaBaixa = (m) => m.presenca != null && m.presenca < 0.6;

export { horas, pct, milhar, FUSO, dataCurta, dataHora, ico, ICO, presencaBaixa };
