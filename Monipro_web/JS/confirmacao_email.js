// JS/confirmacao_email.js
// Plano 14 (RF-018): ações comuns às telas que esperam a confirmação do e-mail (a etapa
// "Confira seu e-mail" do cadastro e o aviso do login): pedir outro link e corrigir o e-mail
// digitado errado. Depende de: api.js (chamadaApi, mensagemDaApi, escaparHtml).

const SVG_EMAIL_CF =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';

/**
 * Monta, dentro de `container`, o botão "Reenviar link" e o "Digitei o e-mail errado".
 * Usa só botões (type="button"), porque no login o painel fica dentro do formulário.
 * @param {HTMLElement} container
 * @param {{ identificador: string, senha: string, tipo_usuario: string,
 *   aoCorrigir?: (email: string) => void }} conta - identificador = e-mail ou matrícula
 */
function montarAcoesConfirmacao(container, conta) {
    container.innerHTML = `
        <p class="cf-status" role="status" aria-live="polite"></p>
        <button type="button" class="rs-pri cf-reenviar">Reenviar link</button>
        <button type="button" class="cf-link cf-abrir" aria-expanded="false">Digitei o e-mail errado</button>
        <div class="cf-corrigir" hidden>
            <label for="cfEmailNovo" class="cf-rotulo">E-mail certo</label>
            <div class="input-group">
                <div class="icone">${SVG_EMAIL_CF}</div>
                <input type="email" id="cfEmailNovo" placeholder="seu.nome@exemplo.edu.br" autocomplete="email">
            </div>
            <button type="button" class="rs-sec cf-salvar">Enviar link para este e-mail</button>
        </div>`;
    const $ = (sel) => container.querySelector(sel);
    const status = $('.cf-status');
    const avisar = (texto, tipo = 'ok') => {
        status.textContent = texto;
        status.dataset.tipo = tipo;
    };

    $('.cf-reenviar').addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Enviando…';
        try {
            const r = await chamadaApi('/auth/email/reenviar', {
                method: 'POST',
                body: JSON.stringify({
                    identificador: conta.identificador,
                    tipo_usuario: conta.tipo_usuario
                })
            });
            if (r.success)
                avisar(
                    'Pronto. Se a conta ainda espera confirmação, o link novo chega em alguns minutos.'
                );
            else avisar(mensagemDaApi(r, 'Não foi possível pedir outro link.'), 'erro');
        } catch {
            avisar('Não foi possível conectar ao servidor. Tente de novo.', 'erro');
        }
        btn.disabled = false;
        btn.textContent = 'Reenviar link';
    });

    $('.cf-abrir').addEventListener('click', (ev) => {
        const painel = $('.cf-corrigir');
        painel.hidden = !painel.hidden;
        ev.currentTarget.setAttribute('aria-expanded', String(!painel.hidden));
        if (!painel.hidden) $('#cfEmailNovo').focus();
    });

    async function corrigir() {
        const emailNovo = $('#cfEmailNovo').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNovo)) {
            avisar('Digite um e-mail válido, como nome@exemplo.edu.br.', 'erro');
            $('#cfEmailNovo').focus();
            return;
        }
        const btn = $('.cf-salvar');
        btn.disabled = true;
        try {
            const r = await chamadaApi('/auth/email/corrigir', {
                method: 'POST',
                body: JSON.stringify({
                    identificador: conta.identificador,
                    senha: conta.senha,
                    tipo_usuario: conta.tipo_usuario,
                    email_novo: emailNovo
                })
            });
            if (r.success) {
                if (conta.identificador.includes('@')) conta.identificador = r.email;
                $('.cf-corrigir').hidden = true;
                $('.cf-abrir').setAttribute('aria-expanded', 'false');
                avisar(`E-mail corrigido. Enviamos o link para ${r.email}.`);
                if (conta.aoCorrigir) conta.aoCorrigir(r.email);
            } else {
                avisar(mensagemDaApi(r, 'Não foi possível corrigir o e-mail.'), 'erro');
            }
        } catch {
            avisar('Não foi possível conectar ao servidor. Tente de novo.', 'erro');
        }
        btn.disabled = false;
    }
    $('.cf-salvar').addEventListener('click', corrigir);
    // Enter no campo corrige o e-mail, em vez de enviar o formulário de login em volta
    $('#cfEmailNovo').addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            corrigir();
        }
    });
}
