document.addEventListener('DOMContentLoaded', async () => {
    const containerDisciplinas = document.querySelector('.disciplinas');
    const token = localStorage.getItem('monipro_token');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // Busca as disciplinas na nova API
        const response = await fetch('https://monipro-beta.onrender.com/disciplinas', {
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
                link.href = `marcar_monitoria.html?disciplinaID=${disciplina.id}&disciplinaNome=${disciplina.nome}`;
                link.className = 'opcao';
                
                // (Aqui pode adicionar ícones baseados no nome, se quiser)
                link.innerHTML = `<span><div class = "icone"><img src="Icone_Disciplina.png"></div>${disciplina.nome}</span>`;
                
                containerDisciplinas.appendChild(link);
            });
        } else if (data.disciplinas.length === 0) {
             containerDisciplinas.innerHTML = '<p>Nenhuma disciplina encontrada.</p>';
        } else {
            showToast(data.message || "Erro ao carregar disciplinas", 'error');
        }
    } catch (error) {
        console.error('Erro ao buscar disciplinas:', error);
        showToast('Não foi possível carregar as disciplinas.', 'error');
    }

});
