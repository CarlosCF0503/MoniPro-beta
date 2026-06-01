// monipro-web/JS/cadastro.js

const SVG_OLHO_ABERTO  = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const SVG_OLHO_FECHADO = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

document.addEventListener('DOMContentLoaded', () => {
    const formCadastro = document.getElementById('formCadastro');

    document.querySelectorAll('.olho').forEach(olho => {
        olho.addEventListener('click', function () {
            const input = document.getElementById(this.dataset.target)
                       || this.parentElement.querySelector('input');
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

    if (!formCadastro) return;

    formCadastro.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome           = document.getElementById('inputNome').value.trim();
        const email          = document.getElementById('inputEmail').value.trim();
        const matricula      = document.getElementById('inputMatricula').value.trim();
        const senha          = document.getElementById('inputSenha').value;
        const confirmarSenha = document.getElementById('inputConfirmarSenha').value;

        if (!nome || !email || !matricula || !senha) {
            if (typeof showToast === 'function') showToast('Preencha todos os campos.', 'error');
            return;
        }
        if (senha !== confirmarSenha) {
            if (typeof showToast === 'function') showToast('As senhas não coincidem!', 'error');
            return;
        }

        // Lê o tipo da URL: cadastro.html?tipo=aluno  ou  cadastro.html?tipo=monitor
        const tipo_usuario = new URLSearchParams(window.location.search).get('tipo') || 'aluno';

        const btnSubmit = document.getElementById('entrar');
        btnSubmit.value    = 'Aguarde...';
        btnSubmit.disabled = true;

        try {
            // Rota correta: POST /auth/cadastro
            const response = await fetch(`${MB_BETA_ORM}/auth/cadastro`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome_completo: nome, email, matricula: Number(matricula), senha, tipo_usuario })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                if (typeof showToast === 'function') showToast('Conta criada com sucesso!', 'success');
                setTimeout(() => { window.location.href = 'index.html'; }, 2000);
            } else {
                const msg = data.detalhe || data.erro || 'Erro ao realizar o cadastro.';
                if (typeof showToast === 'function') showToast(msg, 'error');
            }
        } catch (error) {
            console.error('Erro no cadastro:', error);
            if (typeof showToast === 'function') showToast('Sem ligação ao servidor.', 'error');
        } finally {
            btnSubmit.value    = 'Cadastrar';
            btnSubmit.disabled = false;
        }
    });
});
