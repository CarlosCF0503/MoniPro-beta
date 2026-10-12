// monipro-web/JS/login.js

const SVG_OLHO_ABERTO = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const SVG_OLHO_FECHADO = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

document.addEventListener('DOMContentLoaded', () => {
    // Toggle de senha — troca o conteúdo do SVG ao clicar
    document.querySelectorAll('.olho').forEach((olho) => {
        olho.addEventListener('click', function () {
            const input =
                document.getElementById(this.dataset.target) ||
                this.parentElement.querySelector('input');
            const svg = this.querySelector('svg');
            if (input.type === 'password') {
                input.type = 'text';
                svg.innerHTML = SVG_OLHO_FECHADO;
                this.setAttribute('aria-label', 'Esconder senha');
            } else {
                input.type = 'password';
                svg.innerHTML = SVG_OLHO_ABERTO;
                this.setAttribute('aria-label', 'Mostrar senha');
            }
        });
    });

    // IDs alinhados com o index.html: formLogin, inputIdentificador, inputSenha
    const formLogin = document.getElementById('formLogin');

    if (!formLogin) return;

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        const identificadorInput = document.getElementById('inputIdentificador');
        const senhaInput = document.getElementById('inputSenha');
        const tipoUsuarioInput = document.querySelector('input[name="tipo_usuario"]:checked');

        if (!identificadorInput?.value.trim() || !senhaInput?.value || !tipoUsuarioInput) {
            if (typeof showToast === 'function') showToast('Preencha todos os campos.', 'error');
            return;
        }

        const btnSubmit = document.getElementById('entrar');
        btnSubmit.value = 'Aguarde...';
        btnSubmit.disabled = true;

        try {
            // chamadaApi (api.js) trata resposta não-JSON e registra falhas no console
            const dados = await chamadaApi('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    identificador: identificadorInput.value.trim(),
                    senha: senhaInput.value,
                    tipo_usuario: tipoUsuarioInput.value
                })
            });

            if (dados.success) {
                // Chave padrão do app: 'monipro_token'
                localStorage.setItem('monipro_token', dados.token);
                localStorage.setItem('monipro_usuario', JSON.stringify(dados.usuario));

                if (typeof showToast === 'function')
                    showToast('Login realizado com sucesso!', 'success');
                setTimeout(() => {
                    window.location.href = 'base.html';
                }, 1000);
            } else if (typeof showToast === 'function') {
                showToast(mensagemDaApi(dados, 'Credenciais inválidas.'), 'error', dados);
            }
        } catch (error) {
            if (typeof showToast === 'function')
                showToast('Erro de conexão com o servidor.', 'error', error);
        } finally {
            btnSubmit.value = 'Entrar';
            btnSubmit.disabled = false;
        }
    });
});
