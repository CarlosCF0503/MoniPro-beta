// monipro-web/JS/cadastro.js

document.addEventListener('DOMContentLoaded', () => {
    const formCadastro = document.getElementById('formCadastro');
    const olhos        = document.querySelectorAll('.olho');

    // Mostrar/esconder senha (SVG inline — sem dependência de arquivo de imagem)
    olhos.forEach(olho => {
        olho.addEventListener('click', function () {
            const targetId = this.dataset.target;
            const input    = targetId
                ? document.getElementById(targetId)
                : this.parentElement.querySelector('input');
            const fechado  = this.querySelector('.olho-fechado');
            const aberto   = this.querySelector('.olho-aberto');

            if (input.type === 'password') {
                input.type = 'text';
                if (fechado) fechado.style.display = 'none';
                if (aberto)  aberto.style.display  = 'block';
                this.setAttribute('aria-label', 'Esconder senha');
            } else {
                input.type = 'password';
                if (fechado) fechado.style.display = 'block';
                if (aberto)  aberto.style.display  = 'none';
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
