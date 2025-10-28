// Espera o conteúdo da página carregar
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
    const formCadastro = document.getElementById('formCadastro');
    const erro = document.getElementById('erro');
    const urlParams = new URLSearchParams(window.location.search);
    const tipoUsuario = urlParams.get('tipo');

    if (!tipoUsuario) {
        alert('Por favor, escolha se você é Aluno ou Monitor antes de se cadastrar.');
        window.location.href = 'escolha_cadastro.html';
        return;
    }

    formCadastro.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('inputNome').value;
        const email = document.getElementById('inputEmail').value;
        const senha = document.getElementById('inputSenha').value;
        const confirmarSenha = document.getElementById('inputConfirmarSenha').value;

        erro.textContent = '';
        erro.classList.remove('aparecer');

        if (!nome || !email || !senha || !confirmarSenha) {
            erro.textContent = 'Por favor, preencha todos os campos.';
            erro.classList.add('aparecer');
            return;
        }

        const senhaForteRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
        if (!senhaForteRegex.test(senha)) {
            erro.textContent = 'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número.';
            erro.classList.add('aparecer');
            return;
        }

        if (senha !== confirmarSenha) {
            erro.textContent = 'As senhas não coincidem. Por favor, tente novamente.';
            erro.classList.add('aparecer');
            return;
        }

        try {
    const response = await fetch('http://localhost:3000/cadastro', { /* ... */ });
    const data = await response.json();

    if (data.success) {
        // SUBSTITUÍDO:
        showToast('Cadastro realizado com sucesso!', 'success');
        
        // Adiciona um delay antes de redirecionar
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500); // Redireciona após 1.5 segundos

    } else {
        // SUBSTITUÍDO:
        showToast(data.message || 'Ocorreu um erro no cadastro.', 'error');
    }
} catch (error) {
    console.error('Erro de rede:', error);
    // SUBSTITUÍDO:
    showToast('Não foi possível conectar ao servidor.', 'error');
}
    });

    // --- LÓGICA DO ÍCONE DE MOSTRAR/OCULTAR SENHA ---
    const iconesOlho = document.querySelectorAll('.olho');

    iconesOlho.forEach(icone => {
        icone.addEventListener('click', () => {
            // Encontra o campo de senha que é "irmão" do ícone clicado
            const inputSenha = icone.previousElementSibling;
            const imgIcone = icone.querySelector('img');

            if (inputSenha.type === 'password') {
                inputSenha.type = 'text';
                imgIcone.src = 'IMG/Icone olho.png';
                imgIcone.alt = 'Ocultar senha';
                imgIcone.style.height = '41px';
            } else {
                inputSenha.type = 'password';
                imgIcone.src = 'IMG/Icone olho fechado.png';
                imgIcone.alt = 'Mostrar senha';
                imgIcone.style.height = ''; 
            }
        });
    });

});
