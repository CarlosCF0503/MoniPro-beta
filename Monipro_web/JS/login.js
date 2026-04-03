// monipro-web/JS/login.js

document.addEventListener('DOMContentLoaded', () => {
    // IDs alinhados com o index.html: formLogin, inputIdentificador, inputSenha
    const formLogin = document.getElementById('formLogin');

    if (!formLogin) return;

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        const identificadorInput = document.getElementById('inputIdentificador');
        const senhaInput         = document.getElementById('inputSenha');
        const tipoUsuarioInput   = document.querySelector('input[name="tipo_usuario"]:checked');

        if (!identificadorInput?.value.trim() || !senhaInput?.value || !tipoUsuarioInput) {
            if (typeof showToast === 'function') showToast('Preencha todos os campos.', 'error');
            return;
        }

        const btnSubmit = document.getElementById('entrar');
        btnSubmit.value    = 'Aguarde...';
        btnSubmit.disabled = true;

        try {
            // Usa MB_BETA_ORM definido em api.js — rota: POST /auth/login
            const resposta = await fetch(`${MB_BETA_ORM}/auth/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identificador: identificadorInput.value.trim(),
                    senha:         senhaInput.value,
                    tipo_usuario:  tipoUsuarioInput.value
                })
            });

            const dados = await resposta.json();

            if (resposta.ok && dados.success) {
                // Chave padrão do app: 'monipro_token'
                localStorage.setItem('monipro_token',   dados.token);
                localStorage.setItem('monipro_usuario', JSON.stringify(dados.usuario));

                if (typeof showToast === 'function') showToast('Login realizado com sucesso!', 'success');
                setTimeout(() => { window.location.href = 'base.html'; }, 1000);
            } else {
                const msg = dados.detalhe || dados.erro || 'Credenciais inválidas.';
                if (typeof showToast === 'function') showToast(msg, 'error');
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            if (typeof showToast === 'function') showToast('Erro de conexão com o servidor.', 'error');
        } finally {
            btnSubmit.value    = 'Entrar';
            btnSubmit.disabled = false;
        }
    });
});
