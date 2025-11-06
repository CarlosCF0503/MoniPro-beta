document.addEventListener('DOMContentLoaded', async () => {
    // Pega o token de autenticação salvo no login
    const token = localStorage.getItem('monipro_token');
    let userData = null;

    // Se não houver token, o utilizador não está logado. Redireciona para o login.
    if (!token) {
        showToast('Precisa de estar logado para aceder a esta página.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return;
    }

    // Decodifica o token para saber o tipo de utilizador
    try {
        userData = JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        localStorage.removeItem('monipro_token');
        window.location.href = 'index.html';
        return;
    }
    
    // --- 1. BUSCAR DADOS PRINCIPAIS DO PERFIL ---
    try {
        const response = await fetch('https://monipro-beta.onrender.com/perfil', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            // Preenche os dados na tela
            const { nome_completo, email, tipo_usuario, matricula } = data.user;
            document.getElementById('nomeUsuario').textContent = nome_completo;
            document.getElementById('emailUsuario').textContent = email;
            document.getElementById('matriculaUsuario').textContent = matricula;
            const tipoFormatado = tipo_usuario.charAt(0).toUpperCase() + tipo_usuario.slice(1);
            document.getElementById('tipoUsuario').textContent = tipoFormatado;
        } else {
            throw new Error(data.message || 'Sessão expirou.');
        }
    } catch (error) {
        console.error('Erro ao buscar dados do perfil:', error);
        showToast(error.message || 'Não foi possível carregar os dados do perfil.', 'error');
        localStorage.removeItem('monipro_token');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return; // Para a execução se o perfil principal falhar
    }

    // --- 2. BUSCAR DADOS ESPECÍFICOS (AGENDAMENTOS OU MONITORIAS) ---
    if (userData.tipo === 'aluno') {
        await carregarAgendamentos(token);
    } else if (userData.tipo === 'monitor') {
        await carregarMonitoriasCriadas(token);
    }
});


// Função para buscar e exibir os agendamentos do ALUNO
async function carregarAgendamentos(token) {
    const container = document.getElementById('lista-agendamentos');
    try {
        const response = await fetch('https://monipro-beta.onrender.com/perfil/agendamentos', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.agendamentos.length > 0) {
            container.innerHTML = ''; // Limpa o "A carregar..."
            data.agendamentos.forEach(ag => {
                const dataFormatada = new Date(ag.data_hora).toLocaleString('pt-BR');
                const div = document.createElement('div');
                div.className = 'lista-item';
                div.innerHTML = `
                    <p><strong>${ag.disciplina_nome}</strong> (com ${ag.monitor_nome})</p>
                    <p>${dataFormatada} - <span class="status-${ag.status}">${ag.status}</span></p>
                `;
                container.appendChild(div);
            });
        } else if (data.agendamentos.length === 0) {
            container.innerHTML = '<p>Você ainda não se inscreveu em nenhuma monitoria.</p>';
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        container.innerHTML = '<p>Erro ao carregar seus agendamentos.</p>';
    }
}

// Função para buscar e exibir as monitorias criadas pelo MONITOR
async function carregarMonitoriasCriadas(token) {
    const container = document.getElementById('lista-monitorias-criadas');
    try {
        const response = await fetch('https://monipro-beta.onrender.com/perfil/monitorias', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.monitorias.length > 0) {
            container.innerHTML = ''; // Limpa o "A carregar..."
            data.monitorias.forEach(m => {
                const dataFormatada = new Date(m.horario).toLocaleString('pt-BR');
                const div = document.createElement('div');
                div.className = 'lista-item';
                div.innerHTML = `
                    <p><strong>${m.disciplina_nome}</strong> (${m.local})</p>
                    <p>${dataFormatada} - <span class="status-${m.status}">${m.status}</span></p>
                `;
                container.appendChild(div);
            });
        } else if (data.monitorias.length === 0) {
            container.innerHTML = '<p>Você ainda não criou nenhuma vaga de monitoria.</p>';
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao buscar monitorias:', error);
        container.innerHTML = '<p>Erro ao carregar suas monitorias.</p>';
    }
}
