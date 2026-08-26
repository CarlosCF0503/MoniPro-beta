// monipro-web/JS/perfil.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('monipro_token');
    let userData = null;

    if (!token) {
        if (typeof showToast === 'function') showToast('Sessão expirada. Faça login novamente.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
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
    const confirmModal     = document.getElementById('modal-confirmacao');
    const confirmModalText = document.getElementById('modal-confirmacao-texto');
    const btnConfirmarSim  = document.getElementById('btnConfirmarSim');
    const btnConfirmarNao  = document.getElementById('btnConfirmarNao');
    const overlay          = document.getElementById('overlay');
    let acaoPendente = null;

    const showConfirmModal = (texto) => {
        if (!confirmModal || !overlay) return;
        confirmModalText.textContent = texto;
        overlay.classList.add('active');
        confirmModal.classList.add('aparecer');
    };
    const hideConfirmModal = () => {
        if (!confirmModal || !overlay) return;
        overlay.classList.remove('active');
        confirmModal.classList.remove('aparecer');
        acaoPendente = null;
    };

    if (btnConfirmarSim) btnConfirmarSim.addEventListener('click', () => { if (typeof acaoPendente === 'function') acaoPendente(); hideConfirmModal(); });
    if (btnConfirmarNao) btnConfirmarNao.addEventListener('click', hideConfirmModal);


    // ==========================================
    // 1. CARREGAR DADOS DE IDENTIDADE (Usando chamadaApi)
    // ==========================================
    try {
        const data = await chamadaApi('/perfil');

        if (data.success && data.user) {
            document.getElementById('nomeUsuario').textContent      = data.user.nome_completo || 'Utilizador';
            document.getElementById('emailUsuario').textContent     = data.user.email || '';
            document.getElementById('matriculaUsuario').textContent = data.user.matricula || '';

            const tipo = String(data.user.tipo_usuario);
            document.getElementById('tipoUsuario').textContent = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        } else {
            // Exibe a mensagem real retornada pelo servidor (erro 401, 404, 500, etc.)
            const msgErro = data.mensagem || data.erro || 'Erro ao carregar perfil.';
            if (typeof showToast === 'function') showToast(msgErro, 'error');
            console.error('Erro detalhado do servidor:', data);

            // Se token inválido/expirado, redireciona para login
            if (data.statusHttp === 401) {
                localStorage.removeItem('monipro_token');
                setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            }
        }
    } catch (error) {
        // Erro de REDE (servidor offline, CORS, sem internet)
        const msg = error.message || 'Falha na comunicação com o servidor.';
        if (typeof showToast === 'function') showToast(msg, 'error');
        console.error('Erro de rede ao carregar perfil:', error);
    }

    // ==========================================
    // 2. RENDERIZAR LISTAS POR TIPO DE UTILIZADOR
    // ==========================================
    if (userData.tipo === 'aluno') {
        const container = document.getElementById('lista-agendamentos');
        if (container) {
            await carregarAgendamentos(container);

            container.addEventListener('click', (event) => {
                if (event.target.classList.contains('btn-cancelar')) {
                    const agendamentoId = event.target.dataset.agendamentoId;
                    const itemElement   = event.target.closest('.lista-item');
                    acaoPendente = () => handleSairMonitoria(agendamentoId, itemElement);
                    showConfirmModal('Tem a certeza que deseja cancelar a sua inscrição nesta monitoria?');
                }
            });
        }

    } else if (userData.tipo === 'monitor') {
        const btnCertificados = document.getElementById('btn-certificados');
        if (btnCertificados) btnCertificados.style.display = 'flex';

        const container = document.getElementById('lista-monitorias-criadas');
        if (container) {
            await carregarMonitoriasCriadas(container);

            container.addEventListener('click', (event) => {
                if (event.target.classList.contains('btn-cancelar')) {
                    const monitoriaId = event.target.dataset.monitoriaId;
                    const itemElement = event.target.closest('.lista-item');
                    acaoPendente = () => handleCancelarMonitoria(monitoriaId, itemElement);
                    showConfirmModal('Tem a certeza que deseja cancelar esta vaga de monitoria?');
                }
            });
        }

        // Painel de certificados
        const verCertificadosBtn = document.getElementById('abrir_c');
        const fecharCertBtn      = document.getElementById('fechar_c');
        const certificadosArea   = document.getElementById('area_certificados');
        const overlayCert        = document.getElementById('overlay-cert');

        const abrirCert = () => {
            certificadosArea?.classList.add('aparecer');
            overlayCert?.classList.add('ativo');
            verCertificadosBtn.textContent = 'Fechar';
        };
        const fecharCert = () => {
            certificadosArea?.classList.remove('aparecer');
            overlayCert?.classList.remove('ativo');
            verCertificadosBtn.textContent = 'Ver';
        };

        verCertificadosBtn?.addEventListener('click', () => {
            certificadosArea?.classList.contains('aparecer') ? fecharCert() : abrirCert();
        });
        fecharCertBtn?.addEventListener('click', fecharCert);
        overlayCert?.addEventListener('click', fecharCert);
    }
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
            lista.forEach(ag => {
                const dataFormatada = new Date(ag.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                const nomeDisciplina = ag.monitoria?.disciplina?.nome || 'Disciplina Indefinida';
                const nomeMonitor    = ag.monitoria?.monitor?.nome_completo || 'Monitor';
                const statusStr      = String(ag.status);

                const div = document.createElement('div');
                div.className = 'lista-item';
                div.innerHTML = `
                    <div class="lista-item-info">
                        <p><strong>${nomeDisciplina}</strong> (com ${nomeMonitor})</p>
                        <p>${dataFormatada} — <span class="status-${statusStr.toLowerCase()}">${statusStr.toUpperCase()}</span></p>
                    </div>
                    <button class="btn-cancelar" data-agendamento-id="${ag.id}">Sair</button>
                `;
                container.appendChild(div);
            });
        } else if (data.erro) {
            container.innerHTML = `<p style="color:#D8000C;">Falha do servidor: ${data.mensagem}</p>`;
        } else {
            container.innerHTML = '<p>Ainda não se inscreveu em nenhuma monitoria.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Erro ao carregar os seus agendamentos.</p>';
    }
}

async function carregarMonitoriasCriadas(container) {
    try {
        const data = await chamadaApi('/perfil/monitorias');
        const lista = data.monitorias || [];

        if (!data.erro && lista.length > 0) {
            container.innerHTML = '';
            lista.forEach(m => {
                const dataFormatada = new Date(m.horario).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                const nomeDisciplina = m.disciplina?.nome || 'Disciplina Indefinida';
                const statusStr      = String(m.status);
                const ativa          = ['ativa', 'pendente'].includes(statusStr.toLowerCase());

                const div = document.createElement('div');
                div.className = 'lista-item';
                div.innerHTML = `
                    <div class="lista-item-info">
                        <p><strong>${nomeDisciplina}</strong> (${m.local || 'Local Indefinido'})</p>
                        <p>${dataFormatada} — <span class="status-${statusStr.toLowerCase()}">${statusStr.toUpperCase()}</span></p>
                    </div>
                    ${ativa
                        ? `<button class="btn-cancelar" data-monitoria-id="${m.id}">Cancelar Vaga</button>`
                        : `<span class="status-${statusStr.toLowerCase()}">${statusStr.toUpperCase()}</span>`
                    }
                `;
                container.appendChild(div);
            });
        } else if (data.erro) {
            container.innerHTML = `<p style="color:#D8000C;">Falha do servidor: ${data.mensagem}</p>`;
        } else {
            container.innerHTML = '<p>Ainda não criou nenhuma vaga de monitoria.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Erro ao carregar as suas monitorias.</p>';
    }
}

async function handleSairMonitoria(agendamentoId, itemElement) {
    try {
        const data = await chamadaApi(`/agendamentos/${agendamentoId}`, { method: 'DELETE' });
        if (!data.erro && data.success) {
            // Backend retorna 'mensagem' (pt), não 'message'
            if (typeof showToast === 'function') showToast(data.mensagem || data.message || 'Cancelado com sucesso', 'success');
            itemElement.remove();
        } else {
            if (typeof showToast === 'function') showToast(data.mensagem || data.message || data.erro || 'Erro ao cancelar.', 'error');
        }
    } catch (error) {
        if (typeof showToast === 'function') showToast('Erro de rede.', 'error');
    }
}

async function handleCancelarMonitoria(monitoriaId, itemElement) {
    try {
        const data = await chamadaApi(`/monitorias/${monitoriaId}/cancelar`, { method: 'PUT' });
        if (!data.erro && data.success) {
            if (typeof showToast === 'function') showToast(data.message, 'success');
            const statusEl = itemElement.querySelector('.lista-item-info p:nth-child(2)');
            if (statusEl) {
                const partes = statusEl.innerHTML.split('—');
                statusEl.innerHTML = `${partes[0]}— <span class="status-cancelada" style="color:red;font-weight:bold;">CANCELADA</span>`;
            }
            const btn = itemElement.querySelector('.btn-cancelar');
            if (btn) btn.remove();
        } else {
            if (typeof showToast === 'function') showToast(data.mensagem || data.message || 'Erro ao cancelar.', 'error');
        }
    } catch (error) {
        if (typeof showToast === 'function') showToast('Erro de rede.', 'error');
    }
}
