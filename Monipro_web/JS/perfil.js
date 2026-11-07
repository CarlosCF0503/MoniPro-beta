// monipro-web/JS/perfil.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('monipro_token');
    let userData;

    if (!token) {
        if (typeof showToast === 'function')
            showToast('Sessão expirada. Faça login novamente.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return;
    }

    try {
        userData = JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        localStorage.removeItem('monipro_token');
        window.location.href = 'index.html';
        return;
    }

    // --- MODAL DE CONFIRMAÇÃO ---
    const confirmModal = document.getElementById('modal-confirmacao');
    const confirmModalText = document.getElementById('modal-confirmacao-texto');
    const btnConfirmarSim = document.getElementById('btnConfirmarSim');
    const btnConfirmarNao = document.getElementById('btnConfirmarNao');
    const overlay = document.getElementById('overlay');
    let acaoPendente = null;

    // rotuloConfirmar: o botão diz a ação ("Cancelar inscrição") em vez de um "Sim" genérico
    const showConfirmModal = (texto, rotuloConfirmar = 'Confirmar') => {
        if (!confirmModal || !overlay) return;
        confirmModalText.textContent = texto;
        if (btnConfirmarSim) btnConfirmarSim.textContent = rotuloConfirmar;
        overlay.classList.add('active');
        confirmModal.classList.add('aparecer');
    };
    const hideConfirmModal = () => {
        if (!confirmModal || !overlay) return;
        overlay.classList.remove('active');
        confirmModal.classList.remove('aparecer');
        acaoPendente = null;
    };

    if (btnConfirmarSim)
        btnConfirmarSim.addEventListener('click', () => {
            if (typeof acaoPendente === 'function') acaoPendente();
            hideConfirmModal();
        });
    if (btnConfirmarNao) btnConfirmarNao.addEventListener('click', hideConfirmModal);

    // ==========================================
    // 1. CARREGAR DADOS DE IDENTIDADE (Usando chamadaApi)
    // ==========================================
    try {
        const data = await chamadaApi('/perfil');

        if (data.success && data.user) {
            document.getElementById('nomeUsuario').textContent =
                data.user.nome_completo || 'Usuário';
            document.getElementById('emailUsuario').textContent = data.user.email || '';
            document.getElementById('matriculaUsuario').textContent = data.user.matricula || '';

            const elPontos = document.getElementById('pontosUsuario');
            if (elPontos) elPontos.textContent = `${data.user.pontos || 0} pts`;

            const tipo = String(data.user.tipo_usuario || userData.tipo || 'aluno');
            document.getElementById('tipoUsuario').textContent =
                tipo.charAt(0).toUpperCase() + tipo.slice(1);
        } else {
            // Exibe a mensagem real retornada pelo servidor (erro 401, 404, 500, etc.)
            if (typeof showToast === 'function')
                showToast(mensagemDaApi(data, 'Erro ao carregar perfil.'), 'error', data);

            // Se token inválido/expirado, redireciona para login
            if (data.statusHttp === 401) {
                localStorage.removeItem('monipro_token');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }
        }
    } catch (error) {
        // Erro de REDE (servidor offline, CORS, sem internet)
        const msg = error.message || 'Falha na comunicação com o servidor.';
        if (typeof showToast === 'function') showToast(msg, 'error', error);
    }

    // ==========================================
    // 2. RENDERIZAR LISTAS POR TIPO DE USUÁRIO
    // ==========================================
    if (userData.tipo === 'aluno') {
        const container = document.getElementById('lista-agendamentos');
        if (container) {
            await carregarAgendamentos(container);

            container.addEventListener('click', (event) => {
                if (event.target.classList.contains('btn-cancelar')) {
                    const agendamentoId = event.target.dataset.agendamentoId;
                    const itemElement = event.target.closest('.lista-item');
                    acaoPendente = () => handleSairMonitoria(agendamentoId, itemElement);
                    showConfirmModal(
                        'Tem certeza que deseja cancelar sua inscrição nesta monitoria?',
                        'Cancelar inscrição'
                    );
                }
            });
        }
    }
    // O monitor tem tela e script próprios: perfil_monitor.html + JS/perfil/monitor.js
});

// ==========================================
// FUNÇÕES DE API (Todas atualizadas com chamadaApi)
// ==========================================

async function carregarAgendamentos(container) {
    try {
        const data = await chamadaApi('/perfil/agendamentos');
        const lista = data.agendamentos || [];

        if (!data.erro && lista.length > 0) {
            container.innerHTML = '';
            lista.forEach((ag) => {
                const dataFormatada = new Date(ag.data_hora).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                });
                const nomeDisciplina = escaparHtml(
                    ag.monitoria?.disciplina?.nome || 'Disciplina Indefinida'
                );
                const nomeMonitor = escaparHtml(ag.monitoria?.monitor?.nome_completo || 'Monitor');
                const statusStr = escaparHtml(ag.status);

                const div = document.createElement('div');
                div.className = 'lista-item';
                div.innerHTML = `
                    <div class="lista-item-info">
                        <p><strong>${nomeDisciplina}</strong> (com ${nomeMonitor})</p>
                        <p>${dataFormatada} — <span class="status-${statusStr.toLowerCase()}">${statusStr.toUpperCase()}</span></p>
                    </div>
                    <button class="btn-cancelar" data-agendamento-id="${escaparHtml(ag.id)}">Sair</button>
                `;
                container.appendChild(div);
            });
        } else if (data.erro) {
            // O backend manda o motivo em `erro` (tratadorDeErros.js), não em `mensagem`
            const msg = mensagemDaApi(data, 'Erro ao carregar os seus agendamentos.');
            container.innerHTML = `<p style="color:#D8000C;">Falha do servidor: ${escaparHtml(msg)}</p>`;
            console.error('[MoniPro]', msg, data);
        } else {
            container.innerHTML = '<p>Ainda não se inscreveu em nenhuma monitoria.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Erro ao carregar os seus agendamentos.</p>';
        console.error('[MoniPro] Erro ao carregar os seus agendamentos.', error);
    }
}

async function handleSairMonitoria(agendamentoId, itemElement) {
    try {
        const data = await chamadaApi(`/agendamentos/${agendamentoId}`, { method: 'DELETE' });
        if (!data.erro && data.success) {
            if (typeof showToast === 'function')
                showToast(mensagemDaApi(data, 'Inscrição cancelada com sucesso.'), 'success');
            itemElement.remove();
        } else if (typeof showToast === 'function') {
            showToast(mensagemDaApi(data, 'Erro ao cancelar.'), 'error', data);
        }
    } catch (error) {
        if (typeof showToast === 'function') showToast('Erro de rede.', 'error', error);
    }
}
