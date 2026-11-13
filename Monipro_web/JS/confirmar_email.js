// JS/confirmar_email.js
// Plano 14 (RF-018): o link do e-mail abre esta página com ?token=. A confirmação sai por
// POST /auth/email/confirmar (um GET de verificador de links não confirma sozinho).
// Depende de: api.js (chamadaApi, mensagemDaApi), toast.js.
document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const token = new URLSearchParams(window.location.search).get('token');
    // Tira o token da barra de endereço (e do histórico) assim que ele é lido. Se o navegador
    // recusar (página sem endereço próprio), a tela segue normalmente.
    if (token) {
        try {
            window.history.replaceState(null, '', window.location.pathname);
        } catch {
            // sem efeito: o token só continua visível na barra
        }
    }

    const etapas = ['etapa-confirmando', 'etapa-confirmado', 'etapa-invalido', 'etapa-erro'];
    function mostrar(id) {
        etapas.forEach((e) => ($(e).hidden = e !== id));
        $(id).focus();
    }

    async function confirmar() {
        mostrar('etapa-confirmando');
        try {
            const r = await chamadaApi('/auth/email/confirmar', {
                method: 'POST',
                body: JSON.stringify({ token })
            });
            if (r.success) mostrar('etapa-confirmado');
            // 410: vencido, usado ou trocado; 400: token ausente ou cortado no meio
            else if (r.statusHttp === 410 || r.statusHttp === 400) mostrar('etapa-invalido');
            else {
                $('mensagemErro').textContent = mensagemDaApi(
                    r,
                    'Algo deu errado do nosso lado. Seu link continua valendo: tente de novo em instantes.'
                );
                mostrar('etapa-erro');
            }
        } catch {
            mostrar('etapa-erro');
        }
    }

    $('tentarDeNovo').addEventListener('click', confirmar);
    if (token) confirmar();
    else mostrar('etapa-invalido');
});
