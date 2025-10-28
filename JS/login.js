document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const erro = document.getElementById('erro');

    // Escuta o evento de SUBMIT do formulário inteiro
    formLogin.addEventListener('submit', async (event) => {
        // Previne o comportamento padrão do formulário (recarregar a página)
        event.preventDefault();

        // Pega os valores dos campos de e-mail e senha
        const email = document.getElementById('inputEmail').value;
        const senha = document.getElementById('inputSenha').value;

        // Limpa mensagens de erro antigas
        erro.textContent = '';
        erro.classList.remove('aparecer');

        // Validação de campos vazios
        if (!email || !senha) {
            // Usa a função showToast (do seu arquivo toast.js) para exibir o erro
            showToast('Por favor, preencha e-mail e senha.', 'error');
            return;
        }

        // Descobre qual perfil (aluno/monitor) está selecionado
        const selectedProfile = document.querySelector('input[name="tipo_usuario"]:checked');
        
        if (!selectedProfile) {
            showToast('Por favor, selecione um perfil (Aluno ou Monitor).', 'error');
            return;
        }
        
        const tipoUsuario = selectedProfile.value;

        try {
            // Envia a requisição para o servidor de produção na Render
            const response = await fetch('https://monipro-beta.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Envia o corpo da requisição com os três dados necessários
                body: JSON.stringify({ 
                    email, 
                    senha, 
                    tipo_usuario: tipoUsuario
                }),
            });

            const data = await response.json();

            if (data.success) {
                // Salva o token de sessão no armazenamento do navegador
                localStorage.setItem('monipro_token', data.token);
                // Exibe uma notificação de sucesso
                showToast(`Login como ${tipoUsuario} efetuado com sucesso!`, 'success');
                
                // Redireciona para a página principal após um pequeno delay
                setTimeout(() => {
                    window.location.href = 'base.html'; 
                }, 1000); // Espera 1 segundo para o usuário ver o toast

            } else {
                // Exibe a mensagem de erro retornada pelo servidor
                showToast(data.message || 'Ocorreu um erro no login.', 'error');
            }

        } catch (error) {
            console.error('Erro de rede:', error);
            // Exibe uma mensagem de erro genérica em caso de falha de conexão
            showToast('Não foi possível conectar ao servidor.', 'error');
        }
    });
});
