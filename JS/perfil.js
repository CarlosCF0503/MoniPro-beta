document.addEventListener('DOMContentLoaded', async () => {
    // Pega o token de autenticação salvo no login
    const token = localStorage.getItem('monipro_token');
    let userData = null;

    // --- Seleção dos Elementos do Modal de Confirmação ---
    const confirmModal = document.getElementById('modal-confirmacao');
    const confirmModalText = document.getElementById('modal-confirmacao-texto');
    const btnConfirmarSim = document.getElementById('btnConfirmarSim');
    const btnConfirmarNao = document.getElementById('btnConfirmarNao');
    const overlay = document.getElementById('overlay'); // O overlay é controlado pelo base.js/perfil.js

    // --- Variável de Estado para Guardar a Ação ---
    let acaoPendente = null;

    // Se não houver token, redireciona para o login.
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
    
    // --- Funções de Visibilidade do Modal (controladas por este script) ---
    const showConfirmModal = (text) => {
        if (!confirmModal || !overlay) return;
        confirmModalText.textContent = text;
        overlay.classList.add('active');
        confirmModal.classList.add('aparecer');
    };
    
    const hideConfirmModal = () => {
        if (!confirmModal || !overlay) return;
        overlay.classList.remove('active');
        confirmModal.classList.remove('aparecer');
        acaoPendente = null; // Limpa a ação pendente
    };

    // --- Eventos dos Botões do Novo Modal ---
    btnConfirmarSim.addEventListener('click', () => {
        if (typeof acaoPendente === 'function') {
            acaoPendente(); // Executa a ação guardada (o fetch)
        }
        hideConfirmModal();
    });

    btnConfirmarNao.addEventListener('click', hideConfirmModal);
    
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
        return; 
    }

    // --- 2. BUSCAR DADOS ESPECÍFICOS (AGENDAMENTOS OU MONITORIAS) ---
    if (userData.tipo === 'aluno') {
        const container = document.getElementById('lista-agendamentos');
        await carregarAgendamentos(token, container);
        
        // Adiciona "escutador" para os botões "Sair"
        container.addEventListener('click', (event) => {
            if (event.target.classList.contains('btn-cancelar')) {
                const id = event.target.dataset.agendamentoId;
                const itemElement = event.target.parentElement;
                
                // Guarda a AÇÃO a ser executada e mostra o modal
                acaoPendente = () => handleSairMonitoria(id, itemElement, token);
                showConfirmModal('Tem certeza que deseja sair desta monitoria?');
            }
        });
    } else if (userData.tipo === 'monitor') {
        const container = document.getElementById('lista-monitorias-criadas');
        await carregarMonitoriasCriadas(token, container);
        
        // Adiciona "escutador" para os botões "Cancelar"
        container.addEventListener('click', (event) => {
            if (event.target.classList.contains('btn-cancelar')) {
                const id = event.target.dataset.monitoriaId;
                const itemElement = event.target.parentElement;

                // Guarda a AÇÃO a ser executada e mostra o modal
                acaoPendente = () => handleCancelarMonitoria(id, itemElement, token);
                showConfirmModal('Tem certeza que deseja cancelar esta vaga?');
            }
        });
    }
});

// ========================================================================= //
// FUNÇÕES DE CARREGAMENTO E AÇÃO (FORA DO 'DOMContentLoaded')
// ========================================================================= //

// Função para buscar e exibir os agendamentos do ALUNO
async function carregarAgendamentos(token, container) {
    try {
        const response = await fetch('https://monipro-beta.onrender.com/perfil/agendamentos', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro do servidor');
        }
        
        const data = await response.json();

        if (data.success && data.agendamentos.length > 0) {
            container.innerHTML = '';
            data.agendamentos.forEach(ag => {
                const dataFormatada = new Date(ag.data_hora).toLocaleString('pt-BR');
                const div = document.createElement('div');
                div.className = 'lista-item';
                div.innerHTML = `
                    <div class="lista-item-info">
                        <p><strong>${ag.disciplina_nome}</strong> (com ${ag.monitor_nome})</p>
                        <p>${dataFormatada} - <span class="status-${ag.status}">${ag.status}</span></p>
                    </div>
                    <button class="btn-cancelar" data-agendamento-id="${ag.agendamento_id}">Sair</button>
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
        if (error.message) showToast(error.message, 'error');
    }
}

// Função para buscar e exibir as monitorias criadas pelo MONITOR
async function carregarMonitoriasCriadas(token, container) {
    try {
        const response = await fetch('https://monipro-beta.onrender.com/perfil/monitorias', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro do servidor');
        }

        const data = await response.json();

        if (data.success && data.monitorias.length > 0) {
            container.innerHTML = '';
            data.monitorias.forEach(m => {
                const dataFormatada = new Date(m.horario).toLocaleString('pt-BR');
                const div = document.createElement('div');
                div.className = 'lista-item';
                
                let botaoOuStatus = `<span class="status-${m.status}">${m.status}</span>`;
                if (m.status !== 'cancelada' && m.status !== 'realizada') {
                    botaoOuStatus = `<button class="btn-cancelar" data-monitoria-id="${m.monitoria_id}">Cancelar</button>`;
                }

                div.innerHTML = `
                    <div class="lista-item-info">
                        <p><strong>${m.disciplina_nome}</strong> (${m.local})</p>
                        <p>${dataFormatada} - <span class="status-${m.status}">${m.status}</span></p>
                    </div>
                    ${botaoOuStatus} 
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
        if (error.message) showToast(error.message, 'error');
    }
}

// <<<<<<<<<<<< NOVA FUNÇÃO (ALUNO) - SEM CONFIRM() >>>>>>>>>>>>
async function handleSairMonitoria(agendamentoId, itemElement, token) {
    try {
        const response = await fetch(`https://monipro-beta.onrender.com/agendamento/${agendamentoId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            itemElement.remove(); // Remove o item da lista visualmente
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Erro ao conectar com o servidor.', 'error');
    }
}

// <<<<<<<<<<<< NOVA FUNÇÃO (MONITOR) - SEM CONFIRM() >>>>>>>>>>>>
async function handleCancelarMonitoria(monitoriaId, itemElement, token) {
    try {
        const response = await fetch(`https://monipro-beta.onrender.com/monitoria/${monitoriaId}/cancelar`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            // Atualiza o status visualmente
            const statusElement = itemElement.querySelector('span[class^="status-"]');
            if (statusElement) {
                statusElement.className = 'status-cancelada';
                statusElement.textContent = 'cancelada';
            }
            // Remove o botão
            const btn = itemElement.querySelector('.btn-cancelar');
            if (btn) btn.remove();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Erro ao conectar com o servidor.', 'error');
    }
}