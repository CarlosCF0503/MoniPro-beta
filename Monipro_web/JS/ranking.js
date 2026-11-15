// JS/ranking.js
// Plano 5: ranking de monitores por disciplina e semestre (GET /disciplinas/:id/ranking).
// Mostra só monitores; a linha de quem está vendo vem marcada pela API ("voce").
// Depende de: api.js (chamadaApi, escaparHtml, obterSessao), toast.js, base.js.
document.addEventListener('DOMContentLoaded', async () => {
    const esc = escaparHtml;
    const sel = document.getElementById('rk-disc');
    const lista = document.getElementById('rk-lista');
    const titulo = document.getElementById('rk-titulo');

    const usuario = await obterSessao().catch(() => null);
    if (!usuario) {
        window.location.href = 'index.html';
        return;
    }
    const iniciais = (n) =>
        n
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0])
            .join('')
            .toUpperCase();
    const duracao = (m) =>
        Math.floor(m / 60) + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : '');
    const nomeDoPeriodo = (p) => {
        const [ano, semestre] = String(p || '').split('.');
        return ano ? semestre + 'º semestre de ' + ano : 'neste semestre';
    };
    const linha = (m) =>
        '<li class="rk-item' +
        (m.posicao <= 3 ? ' top' : '') +
        (m.voce ? ' rk-voce' : '') +
        '"><span class="rk-pos"><span>' +
        esc(m.posicao) +
        '</span></span><span class="avatar rk-av" aria-hidden="true">' +
        esc(iniciais(m.nome)) +
        '</span><span class="rk-nome"><b>' +
        esc(m.nome) +
        (m.voce ? ' (você)' : '') +
        '</b><small>' +
        esc(m.sessoes) +
        (m.sessoes === 1 ? ' monitoria' : ' monitorias') +
        ' · ' +
        esc(duracao(m.minutos)) +
        '</small></span><span class="rk-pts">' +
        esc(m.pontos) +
        ' <small>pts</small></span></li>';

    async function mostrar() {
        const nome = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
        titulo.textContent = nome;
        lista.innerHTML =
            '<div class="pp-esqueleto" aria-hidden="true"><span></span><span></span></div>';
        try {
            const r = await chamadaApi(
                '/disciplinas/' + encodeURIComponent(sel.value) + '/ranking'
            );
            if (!r.success)
                throw new Error(mensagemDaApi(r, 'Não foi possível carregar o ranking.'));
            titulo.textContent = nome + ' · ' + nomeDoPeriodo(r.periodo);
            lista.innerHTML = r.ranking.length
                ? '<ol class="rk-lista">' + r.ranking.map(linha).join('') + '</ol>'
                : '<p class="rk-vazio">Nenhum monitor pontuou em ' +
                  esc(nome) +
                  ' neste semestre ainda.</p>';
        } catch {
            lista.innerHTML =
                '<p class="rk-vazio">Não foi possível carregar o ranking. Tente de novo.</p>';
        }
    }

    try {
        const r = await chamadaApi('/disciplinas');
        (r.disciplinas || []).forEach((d) => sel.add(new Option(d.nome, d.id)));
    } catch {
        lista.innerHTML = '<p class="rk-vazio">Não foi possível carregar as disciplinas.</p>';
        return;
    }
    if (!sel.options.length) {
        titulo.textContent = 'Ranking';
        lista.innerHTML = '<p class="rk-vazio">Nenhuma disciplina cadastrada ainda.</p>';
        return;
    }
    const pedida = new URLSearchParams(window.location.search).get('disciplinaID');
    if (pedida && [...sel.options].some((o) => o.value === pedida)) sel.value = pedida;
    sel.addEventListener('change', mostrar);
    mostrar();
});
