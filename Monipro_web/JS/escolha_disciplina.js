// monipro-web/JS/escolha_disciplina.js
// Este arquivo estava AUSENTE no projeto — o escolha_disciplina.html o referenciava
// mas ele nunca existia, fazendo a página ficar presa em "A carregar disciplinas..."

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('monipro_token');

    if (!token) {
        if (typeof showToast === 'function') showToast('Sessão expirada. Faça login novamente.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return;
    }

    const containerDisciplinas = document.querySelector('.disciplinas');
    if (!containerDisciplinas) return;

try {
        // GET /disciplinas — não exige autenticação (rota pública)
        const response = await fetch(`${MB_BETA_ORM}/disciplinas`);
        const dadosDaApi = await response.json(); // Pega o objeto { success: true, disciplinas: [...] }

        // Extrai apenas o array que está DENTRO do objeto
        const listaDisciplinas = dadosDaApi.disciplinas;

        // Agora sim verificamos se a LISTA está vazia
        if (!Array.isArray(listaDisciplinas) || listaDisciplinas.length === 0) {
            containerDisciplinas.innerHTML = '<p>Nenhuma disciplina disponível no momento.</p>';
            return;
        }

        containerDisciplinas.innerHTML = '';

        // Faz o loop na lista correta
        listaDisciplinas.forEach(disc => {
            const card = document.createElement('a');
            card.className = 'disciplina-card';
            // Passa o ID e o nome pela URL para a página de monitorias
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
