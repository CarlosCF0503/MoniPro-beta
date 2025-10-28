document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const erro = document.getElementById('erro');

    formLogin.addEventListener('submit', async (event) => {
        event.preventDefault();

        // ALTERAÇÃO AQUI: Pega o valor do novo campo genérico
        const identificador = document.getElementById('inputIdentificador').value;
        const senha = document.getElementById('inputSenha').value;

        erro.textContent = '';
        erro.classList.remove('aparecer');

        if (!identificador || !senha) {
            showToast('Por favor, preencha o e-mail/matrícula e a senha.', 'error');
            return;
        }

        const selectedProfile = document.querySelector('input[name="tipo_usuario"]:checked');
        
        if (!selectedProfile) {
            showToast('Por favor, selecione um perfil (Aluno ou Monitor).', 'error');
            return;
        }
        
        const tipoUsuario = selectedProfile.value;

        try {
            const response = await fetch('https://monipro-beta.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // ALTERAÇÃO AQUI: Envia 'identificador' em vez de 'email'
                body: JSON.stringify({ 
                    identificador: identificador, 
                    senha, 
                    tipo_usuario: tipoUsuario
                }),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('monipro_token', data.token);
                showToast(`Login como ${tipoUsuario} efetuado com sucesso!`, 'success');
                
                setTimeout(() => {
                    window.location.href = 'base.html'; 
                }, 1000);

            } else {
                showToast(data.message || 'Ocorreu um erro no login.', 'error');
            }

        } catch (error) {
            console.error('Erro de rede:', error);
            showToast('Não foi possível conectar ao servidor.', 'error');
        }
    });
});
