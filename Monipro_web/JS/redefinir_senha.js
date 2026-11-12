// JS/redefinir_senha.js
// Recuperar senha. Sem token na URL: pede o link (POST /auth/senha/esqueci), e a resposta é
// sempre a mesma, exista a conta ou não (evita descobrir e-mails cadastrados).
// Com ?token=: cria a senha nova (POST /auth/senha/redefinir). As regras são as do cadastro.
// Depende de: api.js (chamadaApi, mensagemDaApi), toast.js; o botão de olho vem de login.js.
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
    const etapas = ['etapa-pedir', 'etapa-enviado', 'etapa-nova', 'etapa-feito', 'etapa-invalido'];
    function mostrar(id) {
        etapas.forEach((e) => ($(e).hidden = e !== id));
        const el = $(id);
        if (el.hasAttribute('tabindex')) el.focus();
    }
    mostrar(token ? 'etapa-nova' : 'etapa-pedir');

    $('formPedir').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const email = $('inputEmail').value.trim();
        const erro = $('erroPedir');
        erro.textContent = '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            erro.textContent = 'Digite um e-mail válido, como nome@exemplo.edu.br.';
            $('inputEmail').focus();
            return;
        }
        const btn = $('enviarLink');
        btn.disabled = true;
        btn.value = 'Enviando…';
        try {
            const r = await chamadaApi('/auth/senha/esqueci', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    tipo_usuario: document.querySelector('input[name="tipo_usuario"]:checked').value
                })
            });
            if (r.statusHttp === 429)
                erro.textContent = mensagemDaApi(r, 'Muitas tentativas. Espere alguns minutos.');
            else {
                $('emailEnviado').textContent = email;
                mostrar('etapa-enviado');
            }
        } catch {
            erro.textContent = 'Não foi possível conectar ao servidor. Tente de novo.';
        }
        btn.disabled = false;
        btn.value = 'Enviar link';
    });
    $('pedirDeNovo').addEventListener('click', () => mostrar('etapa-pedir'));

    const regras = {
        tam: (s) => s.length >= 8,
        letra: (s) => /\p{L}/u.test(s),
        num: (s) => /\d/.test(s)
    };
    $('inputNova').addEventListener('input', () => {
        const s = $('inputNova').value;
        document
            .querySelectorAll('#regras li')
            .forEach((li) => li.classList.toggle('ok', regras[li.dataset.regra](s)));
    });
    $('formNova').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const s = $('inputNova').value;
        const erro = $('erroNova');
        erro.textContent = '';
        if (!Object.values(regras).every((f) => f(s))) {
            erro.textContent = 'A senha nova ainda não cumpre as regras acima.';
            return;
        }
        if (s !== $('inputConfirma').value) {
            erro.textContent = 'As duas senhas não são iguais.';
            $('inputConfirma').focus();
            return;
        }
        const btn = $('salvarNova');
        btn.disabled = true;
        btn.value = 'Salvando…';
        try {
            const r = await chamadaApi('/auth/senha/redefinir', {
                method: 'POST',
                body: JSON.stringify({ token, senha: s })
            });
            if (r.success) mostrar('etapa-feito');
            else if (r.statusHttp === 410) mostrar('etapa-invalido');
            else erro.textContent = mensagemDaApi(r, 'Não foi possível salvar a senha.');
        } catch {
            erro.textContent = 'Não foi possível conectar ao servidor. Tente de novo.';
        }
        btn.disabled = false;
        btn.value = 'Salvar senha nova';
    });
});
