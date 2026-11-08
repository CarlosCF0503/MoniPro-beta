// JS/escolha_disciplina.js
document.addEventListener('DOMContentLoaded', async () => {
    const containerDisciplinas = document.querySelector('.disciplinas');
    if (!containerDisciplinas) return;

    // "+ Nova disciplina" só para monitor. Ler o token aqui decide só o que aparece:
    // quem barra de verdade é o 403 do POST /disciplinas.
    const ehMonitor = (() => {
        try {
            const token = localStorage.getItem('monipro_token');
            const dados = token ? JSON.parse(atob(token.split('.')[1])) : null;
            return String(dados?.tipo || dados?.tipo_usuario || '').toLowerCase() === 'monitor';
        } catch {
            return false;
        }
    })();
    const btnNova = document.getElementById('btnNovaDisciplina');
    if (btnNova) btnNova.hidden = !ehMonitor;

    try {
        // ✅ Usa a função centralizada (já trata JSON, token e erros de rede)
        const dados = await chamadaApi('/disciplinas');

        // ✅ Verifica se o servidor retornou erro (status 4xx/5xx)
        if (dados.erro || dados.statusHttp >= 400) {
            throw new Error(mensagemDaApi(dados, `Erro ${dados.statusHttp}`));
        }

        // ✅ Suporta tanto { disciplinas: [...] } quanto array direto
        const listaDisciplinas = Array.isArray(dados) ? dados : dados.disciplinas;

        if (!Array.isArray(listaDisciplinas) || listaDisciplinas.length === 0) {
            containerDisciplinas.innerHTML = '';
            const vazia = document.createElement('div');
            vazia.className = 'lista-vazia';
            const texto = document.createElement('span');
            texto.textContent = 'Nenhuma disciplina disponível no momento.';
            vazia.appendChild(texto);
            if (ehMonitor) {
                const link = document.createElement('a');
                link.href = 'cadastro_disciplina.html';
                link.className = 'btn-nova-disciplina';
                link.textContent = 'Cadastrar a primeira disciplina';
                vazia.appendChild(link);
            }
            containerDisciplinas.appendChild(vazia);
            return;
        }

        containerDisciplinas.innerHTML = '';
        listaDisciplinas.forEach((disc) => {
            const card = document.createElement('a');
            card.className = 'disciplina-card';
            card.href = `marcar_monitoria.html?disciplinaID=${encodeURIComponent(disc.id)}&disciplinaNome=${encodeURIComponent(disc.nome)}`;
            const nome = escaparHtml(disc.nome);
            card.innerHTML = `
                <div class="icone-disciplina">
                    <img src="IMG/Icone_Disciplina.png" alt="${nome}">
                </div>
                <h2>${nome}</h2>
            `;
            containerDisciplinas.appendChild(card);
        });
    } catch (error) {
        console.error('[MoniPro] Erro ao carregar disciplinas:', error.message);
        containerDisciplinas.innerHTML = `<p>Erro ao carregar disciplinas: ${escaparHtml(error.message)}</p>`;
    }
});
