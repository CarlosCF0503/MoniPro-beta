




// Espera o conteúdo da página carregar
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
    const formCadastro = document.getElementById('formCadastro');
    const erro = document.getElementById('erro');
    const urlParams = new URLSearchParams(window.location.search);
    const tipoUsuario = urlParams.get('tipo');

    if (!tipoUsuario) {
        // Usa a função showToast para consistência
        showToast('Erro: Perfil não selecionado. Por favor, volte e escolha um.', 'error');
        setTimeout(() => {
            window.location.href = 'escolha_cadastro.html';
        }, 2000);
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
            showToast('Por favor, preencha todos os campos.', 'error');
            return;
        }

        const senhaForteRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
        if (!senhaForteRegex.test(senha)) {
            showToast('A senha deve ter no mínimo 8 caracteres, com uma letra e um número.', 'error');
            return;
        }

        if (senha !== confirmarSenha) {
            showToast('As senhas não coincidem. Por favor, tente novamente.', 'error');
            return;
        }

        try {
            // ================================================================= //
            // CORREÇÃO: URL atualizada para o servidor de produção na Render
            const response = await fetch('https://monipro-beta.onrender.com/cadastro', {
            // ================================================================= //
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome_completo: nome,
                    email: email,
                    senha: senha,
                    tipo_usuario: tipoUsuario
                }),
            });

            const data = await response.json();

            if (data.success) {
                showToast('Cadastro realizado com sucesso!', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                showToast(data.message || 'Ocorreu um erro no cadastro.', 'error');
            }
        } catch (error) {
            console.error('Erro de rede:', error);
            showToast('Não foi possível conectar ao servidor. Tente novamente mais tarde.', 'error');
        }
    });

    // --- LÓGICA DO ÍCONE DE MOSTRAR/OCULTAR SENHA ---
    const iconesOlho = document.querySelectorAll('.olho');

    iconesOlho.forEach(icone => {
        icone.addEventListener('click', () => {
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




