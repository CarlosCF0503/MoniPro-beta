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
    const response = await fetch('http://localhost:3000/login', { /* ... */ });
    const data = await response.json();

    if (data.success) {
        // SUBSTITUÍDO:
        showToast(`Login como ${tipoUsuario} efetuado com sucesso!`, 'success');
        localStorage.setItem('monipro_token', data.token);
        
        // Adiciona um pequeno delay antes de redirecionar para dar tempo de ler o toast
        setTimeout(() => {
            window.location.href = 'base.html';
        }, 1000); // Redireciona após 1 segundo

    } else {
        // SUBSTITUÍDO:
        showToast(data.message || 'Ocorreu um erro no login.', 'error');
    }

} catch (error) {
    console.error('Erro de rede:', error);
    // SUBSTITUÍDO:
    showToast('Não foi possível conectar ao servidor.', 'error');
}
    });

});
