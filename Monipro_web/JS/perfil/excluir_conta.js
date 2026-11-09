// JS/perfil/excluir_conta.js
// R3 (LGPD): "Excluir minha conta" nos perfis do aluno e do monitor (computador e celular).
// aluno.js e monitor.js colocam PerfilExcluirConta.blocoHTML() nos dados do usuário; este
// arquivo cria o diálogo, pede a senha e chama DELETE /perfil. Depende de api.js e toast.js.

const PerfilExcluirConta = (() => {
    const ID = 'dlg-excluir-conta';

    function blocoHTML() {
        return (
            '<div class="pp-privacidade">' +
            '<a href="privacidade.html">Aviso de Privacidade</a>' +
            '<button type="button" class="pp-btn pp-btn-texto-perigo" data-excluir-conta>Excluir minha conta</button>' +
            '</div>'
        );
    }

    function criarDialogo() {
        const dlg = document.createElement('dialog');
        dlg.className = 'pp-dlg';
        dlg.id = ID;
        dlg.setAttribute('aria-labelledby', 'exc-titulo');
        dlg.innerHTML =
            '<form method="dialog" id="exc-form" novalidate>' +
            '<div><h2 id="exc-titulo">Excluir sua conta?</h2>' +
            '<p class="pp-sub">Esta ação não pode ser desfeita.</p></div>' +
            '<ul class="pp-exc-lista">' +
            '<li>Seu nome, e-mail, matrícula e senha são apagados.</li>' +
            '<li>Suas inscrições e vagas futuras são canceladas.</li>' +
            '<li>O histórico de monitorias passadas fica, sem nada que identifique você.</li>' +
            '</ul>' +
            '<div class="pp-campo">' +
            '<label class="pp-rotulo" for="exc-senha">Digite sua senha para confirmar</label>' +
            '<input type="password" id="exc-senha" name="senha" autocomplete="current-password" required aria-describedby="exc-erro">' +
            '<p class="pp-erro" id="exc-erro" role="alert"></p>' +
            '</div>' +
            '<div class="pp-acoes">' +
            '<button type="button" class="pp-btn pp-btn-sec" data-fechar>Manter conta</button>' +
            '<button type="submit" class="pp-btn pp-btn-perigo" id="exc-confirmar">Excluir conta</button>' +
            '</div></form>';
        document.body.appendChild(dlg);

        const form = dlg.querySelector('#exc-form');
        const senha = dlg.querySelector('#exc-senha');
        const erro = dlg.querySelector('#exc-erro');
        const botao = dlg.querySelector('#exc-confirmar');

        function mostrarErro(texto) {
            erro.textContent = texto;
            senha.setAttribute('aria-invalid', texto ? 'true' : 'false');
            if (texto) senha.focus();
        }

        dlg.querySelector('[data-fechar]').addEventListener('click', () => dlg.close());
        dlg.addEventListener('close', () => {
            form.reset();
            mostrarErro('');
        });

        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            if (!senha.value) return mostrarErro('Digite a sua senha.');
            botao.disabled = true;
            botao.textContent = 'Excluindo…';
            try {
                const r = await chamadaApi('/perfil', {
                    method: 'DELETE',
                    body: JSON.stringify({ senha: senha.value })
                });
                if (r.success) {
                    dlg.close();
                    showToast('Sua conta foi excluída.', 'success');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                    return;
                }
                mostrarErro(
                    r.statusHttp === 401
                        ? 'Sua sessão terminou. Entre de novo para excluir a conta.'
                        : mensagemDaApi(r, 'Não foi possível excluir a conta.')
                );
            } catch (e) {
                mostrarErro('Erro de rede. Verifique a conexão e tente de novo.');
                console.error('[MoniPro]', e);
            } finally {
                botao.disabled = false;
                botao.textContent = 'Excluir conta';
            }
        });
        return dlg;
    }

    let gatilho = null;
    document.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-excluir-conta]');
        if (!b) return;
        gatilho = b;
        const dlg = document.getElementById(ID) || criarDialogo();
        dlg.showModal();
        dlg.querySelector('#exc-senha').focus();
        dlg.addEventListener(
            'close',
            () => {
                if (gatilho && document.body.contains(gatilho)) gatilho.focus();
            },
            { once: true }
        );
    });

    return { blocoHTML };
})();
