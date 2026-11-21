// JS/certificado.js
// Certificados (PR 3): monta a declaração de horas a partir de GET /certificados/:codigo (só o
// dono) e deixa imprimir ou salvar em PDF pelo navegador.
// Depende de: api.js (chamadaApi, escaparHtml, mensagemDaApi), toast.js.
document.addEventListener('DOMContentLoaded', async () => {
    const esc = escaparHtml;
    const folha = document.getElementById('cert-folha');
    const aviso = document.getElementById('cert-aviso');
    const codigo = new URLSearchParams(window.location.search).get('c') || '';

    const duracao = (m) =>
        Math.floor(m / 60) + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : '');
    const nomeDoPeriodo = (p) => {
        const [ano, semestre] = String(p).split('.');
        return semestre + 'º semestre de ' + ano;
    };
    const data = (iso) =>
        new Date(iso).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
        });
    const codigoLegivel = (c) => c.match(/.{1,4}/g).join('-');

    function erro(texto) {
        folha.removeAttribute('aria-busy');
        folha.innerHTML = '<p class="cert-erro">' + esc(texto) + '</p>';
    }

    let r;
    try {
        r = await chamadaApi('/certificados/' + encodeURIComponent(codigo));
    } catch {
        return erro('Não foi possível conectar ao servidor. Tente de novo.');
    }
    if (r.statusHttp === 401) {
        window.location.href = 'index.html';
        return;
    }
    if (!r.success) return erro(mensagemDaApi(r, 'Declaração não encontrada.'));

    const c = r.certificado;
    const s = c.snapshot;
    // Endereço da verificação pública: o domínio do próprio site (hml ou produção)
    const origem = /^https?:/.test(window.location.origin)
        ? window.location.origin
        : 'https://moni-pro.app.br';
    const verificacao = origem + '/verificar.html?c=' + c.codigo;

    if (c.situacao !== 'valido') {
        aviso.hidden = false;
        aviso.textContent =
            c.situacao === 'substituido'
                ? 'Esta declaração foi substituída por uma emitida depois. Use a mais recente.'
                : 'Esta declaração foi revogada e não vale mais.';
    }

    const linhas = (s.por_disciplina || [])
        .map(
            (d) =>
                '<tr><td>' +
                esc(d.disciplina) +
                '</td><td class="n">' +
                esc(d.sessoes) +
                '</td><td class="n">' +
                esc(duracao(d.minutos)) +
                '</td></tr>'
        )
        .join('');

    folha.removeAttribute('aria-busy');
    folha.innerHTML =
        '<header class="cert-cab"><img src="IMG/MoniPro-Logo.png" alt="MoniPro" class="cert-logo">' +
        '<p class="cert-plataforma">MoniPro · Monitorias acadêmicas</p></header>' +
        '<h1>Declaração de horas de monitoria</h1>' +
        '<p class="cert-texto">Declaramos, para os devidos fins, que <strong>' +
        esc(s.nome) +
        '</strong> atuou como monitor(a) na plataforma MoniPro no <strong>' +
        esc(nomeDoPeriodo(c.periodo)) +
        '</strong>, com carga horária comprovada de <strong>' +
        esc(duracao(c.carga_minutos)) +
        '</strong> em ' +
        esc(s.sessoes_total) +
        (s.sessoes_total === 1 ? ' monitoria' : ' monitorias') +
        ', distribuída assim:</p>' +
        '<table class="cert-tabela"><thead><tr><th>Disciplina</th><th class="n">Monitorias</th><th class="n">Horas</th></tr></thead><tbody>' +
        linhas +
        '</tbody><tfoot><tr><td>Total</td><td class="n">' +
        esc(s.sessoes_total) +
        '</td><td class="n">' +
        esc(duracao(c.carga_minutos)) +
        '</td></tr></tfoot></table>' +
        '<p class="cert-regra">Contam as monitorias finalizadas com pelo menos uma presença confirmada pelo aluno e pelo monitor, até 4 horas por sessão.</p>' +
        '<footer class="cert-rodape"><p>Emitida em ' +
        esc(data(c.emitido_em)) +
        ' pela plataforma MoniPro.</p>' +
        // Plano 7: assinatura da coordenação, quando houver
        (c.assinado_em
            ? '<p class="cert-assinatura">Assinada pela coordenação: <strong>' +
              esc(c.assinante) +
              '</strong>, em ' +
              esc(data(c.assinado_em)) +
              '.</p>'
            : '') +
        '<p>Código de verificação: <strong class="cert-codigo">' +
        esc(codigoLegivel(c.codigo)) +
        '</strong></p><p>Confira em <span class="cert-url">' +
        esc(verificacao) +
        '</span></p></footer>';

    const botao = document.getElementById('imprimir');
    botao.hidden = false;
    botao.addEventListener('click', () => window.print());
});
