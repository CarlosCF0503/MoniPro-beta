document.addEventListener('DOMContentLoaded', async () => {
    const containerDisciplinas = document.querySelector('.disciplinas');
    const token = localStorage.getItem('monipro_token');

    if (!token) {
        // Se não há token, não há como buscar dados, redireciona para o login
        showToast('Sessão inválida. Por favor, faça login.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return;
    }

    try {
        // Busca as disciplinas na nova API
        const response = await fetch('https://monipro-beta.onrender.com/disciplinas', {
            // ========================================================================= //
            // CORREÇÃO: Adiciona o cabeçalho de Autorização com o token
            // ========================================================================= //
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();

        if (data.success && data.disciplinas.length > 0) {
            // Limpa o container
            containerDisciplinas.innerHTML = '';
            
            // Cria um link para cada disciplina retornada pelo banco
            data.disciplinas.forEach(disciplina => {
                const link = document.createElement('a');
                // Passa o ID e o Nome para a próxima página
                link.href = `marcar_monitoria.html?disciplinaID=${disciplina.id}&disciplinaNome=${disciplina.nome}`;
                link.className = 'opcao';
                
                // (Aqui pode adicionar ícones baseados no nome, se quiser)
                link.innerHTML = `<span>${disciplina.nome}</span>`;
                
                containerDisciplinas.appendChild(link);
            });
        } else if (data.disciplinas.length === 0) {
             containerDisciplinas.innerHTML = '<p>Nenhuma disciplina encontrada.</p>';
        } else {
            // Se o token for inválido/expirado, o servidor retornará um erro
            showToast(data.message || "Erro ao carregar disciplinas", 'error');
        }
    } catch (error) {
        // O erro 403/401 do servidor também pode cair aqui
        console.error('Erro ao buscar disciplinas:', error);
        showToast('Não foi possível carregar as disciplinas. Tente fazer login novamente.', 'error');
    }
});
