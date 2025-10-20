document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const erro = document.getElementById('erro');

    // Escuta o evento de SUBMIT do formulário inteiro
    formLogin.addEventListener('submit', async (event) => {
        // Previne o comportamento padrão do formulário
        event.preventDefault();

        // Pega os valores dos campos
        const email = document.getElementById('inputEmail').value;
        const senha = document.getElementById('inputSenha').value;

        // Limpa mensagens de erro
        erro.textContent = '';
        erro.classList.remove('aparecer');

        if (!email || !senha) {
            erro.textContent = 'Por favor, preencha e-mail e senha.';
            erro.classList.add('aparecer');
            return;
        }

        // --- CORREÇÃO: Descobre qual perfil está selecionado ---
        const selectedProfile = document.querySelector('input[name="tipo_usuario"]:checked');
        
        if (!selectedProfile) {
            erro.textContent = 'Por favor, selecione um perfil (Aluno ou Monitor).';
            erro.classList.add('aparecer');
            return;
        }
        
        const tipoUsuario = selectedProfile.value;
        // --- FIM DA CORREÇÃO ---

        try {
            const response = await fetch('https://moni-pro-tela-de-login-funcional.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // --- CORREÇÃO: Envia o tipo de usuário selecionado ---
                body: JSON.stringify({ 
                    email, 
                    senha, 
                    tipo_usuario: tipoUsuario
                }),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('monipro_token', data.token);
                alert(`Login como ${tipoUsuario} efetuado com sucesso!`);
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