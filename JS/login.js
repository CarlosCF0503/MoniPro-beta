document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const erro = document.getElementById('erro');

    formLogin.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('inputEmail').value;
        const senha = document.getElementById('inputSenha').value;

        erro.textContent = '';
        erro.classList.remove('aparecer');

        if (!email || !senha) {
            erro.textContent = 'Por favor, preencha e-mail e senha.';
            erro.classList.add('aparecer');
            return;
        }

        try {
            const response = await fetch('https://moni-pro-tela-de-login-funcional.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha }),
            });

            const data = await response.json();

            if (data.success) {
                // ============================================================= //
                // ADICIONADO: Salva o token no armazenamento local do navegador
                localStorage.setItem('monipro_token', data.token);
                // ============================================================= //
                
                alert('Login efetuado com sucesso!');
                // A linha abaixo deve levar para a página principal do seu sistema
                window.location.href = 'base.html'; 
            } else {
                erro.textContent = data.message || 'Ocorreu um erro no login.';
                erro.classList.add('aparecer');
            }

        } catch (error) {
            console.error('Erro de rede:', error);
            erro.textContent = 'Não foi possível conectar ao servidor.';
            erro.classList.add('aparecer');
        }
    });

});



