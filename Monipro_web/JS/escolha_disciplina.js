// JS/escolha_disciplina.js
document.addEventListener('DOMContentLoaded', async () => {
    const containerDisciplinas = document.querySelector('.disciplinas');
    if (!containerDisciplinas) return;

    try {
        // ✅ Usa a função centralizada (já trata JSON, token e erros de rede)
        const dados = await chamadaApi('/disciplinas');

        // ✅ Verifica se o servidor retornou erro (status 4xx/5xx)
        if (dados.erro || dados.statusHttp >= 400) {
            throw new Error(dados.mensagem || `Erro ${dados.statusHttp}`);
        }

        // ✅ Suporta tanto { disciplinas: [...] } quanto array direto
        const listaDisciplinas = Array.isArray(dados) ? dados : dados.disciplinas;

        if (!Array.isArray(listaDisciplinas) || listaDisciplinas.length === 0) {
            containerDisciplinas.innerHTML = '<p>Nenhuma disciplina disponível no momento.</p>';
            return;
        }

        containerDisciplinas.innerHTML = '';
        listaDisciplinas.forEach(disc => {
            const card = document.createElement('a');
            card.className = 'disciplina-card';
            card.href = `marcar_monitoria.html?disciplinaID=${disc.id}&disciplinaNome=${encodeURIComponent(disc.nome)}`;
            // XSS: disc.nome vem da API sem sanitização no backend.
            card.innerHTML = html`
                <div class="icone-disciplina">
                    <img src="IMG/Icone_Disciplina.png" alt="${disc.nome}">
                </div>
                <h2>${disc.nome}</h2>
            `;
            containerDisciplinas.appendChild(card);
        });

    } catch (error) {
        console.error('Erro ao carregar disciplinas:', error.message);
        containerDisciplinas.innerHTML = html`<p>Erro ao carregar disciplinas: ${error.message}</p>`;
    }
});
