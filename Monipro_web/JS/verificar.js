// JS/verificar.js
// Certificados (PR 4): verificação pública de uma declaração pelo código
// (GET /certificados/verificar/:codigo). Não exige login.
// Depende de: api.js (chamadaApi, escaparHtml, mensagemDaApi), toast.js.
document.addEventListener('DOMContentLoaded', () => {
    const esc = escaparHtml;
    const form = document.getElementById('vf-form');
    const campo = document.getElementById('vf-codigo');
    const erro = document.getElementById('vf-erro');
    const resultado = document.getElementById('vf-resultado');
    const botao = document.getElementById('vf-conferir');

    const ALFABETO = /[23456789ABCDEFGHJKMNPQRSTVWXYZ]/;
    const limpar = (t) =>
        String(t || '')
            .toUpperCase()
            .replace(/[\s-]/g, '');
    const legivel = (c) => (c.match(/.{1,4}/g) || []).join('-');
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
    const SITUACAO = {
        valido: ['ok', 'Válida', 'Esta declaração foi emitida pelo MoniPro e continua valendo.'],
        substituido: [
            'aviso',
            'Substituída',
            'Esta declaração foi emitida pelo MoniPro, mas o titular emitiu outra depois para o mesmo semestre. Peça a mais recente.'
        ],
        revogado: ['perigo', 'Revogada', 'Esta declaração foi revogada e não vale mais.']
    };

    function mostrar(d, codigo) {
        const [classe, rotulo, texto] = SITUACAO[d.situacao] || ['aviso', d.situacao, ''];
        resultado.hidden = false;
        resultado.className = 'vf-resultado ' + classe;
        resultado.innerHTML =
            '<p class="vf-sit">' +
            esc(rotulo) +
            '</p><p class="vf-explica">' +
            esc(texto) +
            '</p><dl class="vf-dados">' +
            '<div><dt>Titular</dt><dd>' +
            esc(d.nome) +
            '</dd></div><div><dt>Semestre</dt><dd>' +
            esc(nomeDoPeriodo(d.periodo)) +
            '</dd></div><div><dt>Carga horária</dt><dd>' +
            esc(duracao(d.carga_minutos)) +
            '</dd></div><div><dt>Emitida em</dt><dd>' +
            esc(data(d.emitido_em)) +
            '</dd></div>' +
            // Plano 7: quem da coordenação assinou
            (d.assinado_em
                ? '<div><dt>Assinada por</dt><dd>' +
                  esc(d.assinante) +
                  ', em ' +
                  esc(data(d.assinado_em)) +
                  '</dd></div>'
                : '') +
            (d.revogado_em
                ? '<div><dt>Revogada em</dt><dd>' + esc(data(d.revogado_em)) + '</dd></div>'
                : '') +
            '<div><dt>Código</dt><dd class="vf-cod">' +
            esc(legivel(codigo)) +
            '</dd></div></dl>';
        resultado.focus();
    }

    async function conferir(codigo) {
        erro.textContent = '';
        resultado.hidden = true;
        if (codigo.length !== 26 || [...codigo].some((ch) => !ALFABETO.test(ch))) {
            erro.textContent =
                'O código tem 26 letras e números. Confira o que está impresso na declaração.';
            campo.focus();
            return;
        }
        botao.disabled = true;
        botao.textContent = 'Conferindo…';
        try {
            const r = await chamadaApi('/certificados/verificar/' + encodeURIComponent(codigo));
            if (r.success) mostrar(r.declaracao, codigo);
            else if (r.statusHttp === 404)
                erro.textContent = 'Nenhuma declaração com este código. Confira se digitou certo.';
            else
                erro.textContent = mensagemDaApi(
                    r,
                    'Não foi possível conferir agora. Tente de novo.'
                );
        } catch {
            erro.textContent = 'Não foi possível conectar ao servidor. Tente de novo.';
        }
        botao.disabled = false;
        botao.textContent = 'Conferir';
    }

    form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        conferir(limpar(campo.value));
    });

    // Código vindo do endereço (link ou QR da declaração): já confere
    const doEndereco = limpar(new URLSearchParams(window.location.search).get('c'));
    if (doEndereco) {
        campo.value = legivel(doEndereco);
        conferir(doEndereco);
    }
});
