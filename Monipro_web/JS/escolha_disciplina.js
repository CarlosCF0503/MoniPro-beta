// monipro-web/JS/escolha_disciplina.js

document.addEventListener('DOMContentLoaded', async () => {
    const containerDisciplinas = document.querySelector('.disciplinas');
    if (!containerDisciplinas) return;

    try {
        // Padronizado para seguir o estilo do cadastro.js e a nova rota /auth
        const response = await fetch(`${MB_BETA_ORM}/auth/disciplinas`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
                // Se a rota for pública, não precisa do Authorization aqui
            }
        });

        const dadosDaApi = await response.json();
        const listaDisciplinas = dadosDaApi.disciplinas;

        if (!Array.isArray(listaDisciplinas) || listaDisciplinas.length === 0) {
            containerDisciplinas.innerHTML = '<p>Nenhuma disciplina disponível no momento.</p>';
            return;
        }

        containerDisciplinas.innerHTML = '';

        listaDisciplinas.forEach(disc => {
            const card = document.createElement('a');
            card.className = 'disciplina-card';
            card.href = `marcar_monitoria.html?disciplinaID=${disc.id}&disciplinaNome=${encodeURIComponent(disc.nome)}`;
            card.innerHTML = `
                <div class="icone-disciplina">
                    <img src="IMG/Icone_Disciplina.png" alt="${disc.nome}">
                </div>
                <h2>${disc.nome}</h2>
            `;
            containerDisciplinas.appendChild(card);
        });

    } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
        containerDisciplinas.innerHTML = '<p>Erro ao carregar disciplinas. Tente novamente.</p>';
    }
});
