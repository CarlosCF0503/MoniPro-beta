document.addEventListener('DOMContentLoaded', async () => {
    // Pega o token de autenticação salvo no login
    const token = localStorage.getItem('monipro_token');

    // Se não houver token, o utilizador não está logado. Redireciona para o login.
    if (!token) {
        showToast('Precisa de estar logado para aceder a esta página.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return;
    }

    try {
        // Faz a requisição para a rota /perfil, enviando o token para autorização
        // (Usa a URL de produção da Render)
        const response = await fetch('https://monipro-beta.onrender.com/perfil', {
            method: 'GET',
            headers: {
                // Envia o token no formato "Bearer"
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            // Se a requisição foi bem-sucedida, preenche os dados na tela
            const { nome_completo, email, tipo_usuario, matricula } = data.user;

            document.getElementById('nomeUsuario').textContent = nome_completo;
            document.getElementById('emailUsuario').textContent = email;
            document.getElementById('matriculaUsuario').textContent = matricula;
            
            // Capitaliza a primeira letra do tipo de utilizador (ex: "aluno" -> "Aluno")
            const tipoFormatado = tipo_usuario.charAt(0).toUpperCase() + tipo_usuario.slice(1);
            document.getElementById('tipoUsuario').textContent = tipoFormatado;

        } else {
            // Se o token for inválido ou expirar, desloga o utilizador
            showToast(data.message || 'A sua sessão expirou. Por favor, faça login novamente.', 'error');
            localStorage.removeItem('monipro_token');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    } catch (error) {
        console.error('Erro ao buscar dados do perfil:', error);
        showToast('Não foi possível carregar os dados do perfil.', 'error');
    }
});
