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

    // --- DADOS DO PERFIL ---
    // GET /perfil → resposta: { success: true, user: { ... } }
    try {
        const response = await fetch(`${MB_BETA_ORM}/perfil`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('nomeUsuario').textContent     = data.user.nome_completo || 'Utilizador';
            document.getElementById('emailUsuario').textContent    = data.user.email || '';
            document.getElementById('matriculaUsuario').textContent = data.user.matricula || '';

            const tipo = String(data.user.tipo_usuario);
            document.getElementById('tipoUsuario').textContent = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        } else {
            if (typeof showToast === 'function') showToast(data.erro || 'Erro ao carregar perfil.', 'error');
            return;
        }
    } catch (error) {
        if (typeof showToast === 'function') showToast('Não foi possível carregar os dados do perfil.', 'error');
        return;
    }

    // --- INTERFACE POR TIPO DE UTILIZADOR ---
    if (userData.tipo === 'aluno') {
        const areaAluno = document.getElementById('area-aluno');
        if (areaAluno) areaAluno.style.display = 'block';

        const container = document.getElementById('lista-agendamentos');
        if (container) {
            await carregarAgendamentos(token, container);

            container.addEventListener('click', (event) => {
                if (event.target.classList.contains('btn-cancelar')) {
                    const agendamentoId = event.target.dataset.agendamentoId;
                    const itemElement   = event.target.closest('.lista-item');
                    acaoPendente = () => handleSairMonitoria(agendamentoId, itemElement, token);
                    showConfirmModal('Tem a certeza que deseja cancelar a sua inscrição nesta monitoria?');
                }
            });
        }

    } else if (userData.tipo === 'monitor') {
        const areaMonitor    = document.getElementById('area-monitor');
        const btnCertificados = document.getElementById('btn-certificados');
        if (areaMonitor)     areaMonitor.style.display    = 'block';
        if (btnCertificados) btnCertificados.style.display = 'flex';

        const container = document.getElementById('lista-monitorias-criadas');
        if (container) {
            await carregarMonitoriasCriadas(token, container);

            container.addEventListener('click', (event) => {
                if (event.target.classList.contains('btn-cancelar')) {
                    const monitoriaId = event.target.dataset.monitoriaId;
                    const itemElement = event.target.closest('.lista-item');
                    acaoPendente = () => handleCancelarMonitoria(monitoriaId, itemElement, token);
                    showConfirmModal('Tem a certeza que deseja cancelar esta vaga de monitoria?');
                }
            });
        }

        // Painel de certificados
        const verCertificadosBtn = document.getElementById('abrir_c');
        const perfilCard         = document.getElementById('perfil_informacao');
        const certificadosArea   = document.getElementById('area_certificados');

        if (verCertificadosBtn && certificadosArea && perfilCard) {
            verCertificadosBtn.addEventListener('click', () => {
                certificadosArea.classList.toggle('aparecer');
                perfilCard.classList.toggle('mudar');
                const p = verCertificadosBtn.querySelector('p');
                if (p) p.textContent = certificadosArea.classList.contains('aparecer') ? 'voltar' : 'ver';
            });
        }
    }
});

// --- FUNÇÕES DE API ---

async function carregarAgendamentos(token, container) {
    try {
        // GET /perfil/agendamentos → { success: true, agendamentos: [...] }
        const response = await fetch(`${MB_BETA_ORM}/perfil/agendamentos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const lista = data.agendamentos || [];

        if (data.success && lista.length > 0) {
            container.innerHTML = '';
            lista.forEach(ag => {
                const dataFormatada = new Date(ag.data_hora)
                    .toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

                const nomeDisciplina = ag.monitoria?.disciplina?.nome || 'Disciplina Indefinida';
                // Campo correto do Prisma: ag.monitoria.monitor.nome_completo
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
        } else {
            container.innerHTML = '<p>Ainda não se inscreveu em nenhuma monitoria.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Erro ao carregar os seus agendamentos.</p>';
    }
}

async function carregarMonitoriasCriadas(token, container) {
    try {
        // GET /perfil/monitorias → { success: true, monitorias: [...] }
        const response = await fetch(`${MB_BETA_ORM}/perfil/monitorias`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const lista = data.monitorias || [];

        if (data.success && lista.length > 0) {
            container.innerHTML = '';
            lista.forEach(m => {
                const dataFormatada = new Date(m.horario)
                    .toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

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
        } else {
            container.innerHTML = '<p>Ainda não criou nenhuma vaga de monitoria.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Erro ao carregar as suas monitorias.</p>';
    }
}

async function handleSairMonitoria(agendamentoId, itemElement, token) {
    try {
        // DELETE /agendamentos/:id
        const response = await fetch(`${MB_BETA_ORM}/agendamentos/${agendamentoId}`, {
            method:  'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            if (typeof showToast === 'function') showToast(data.message, 'success');
            itemElement.remove();
        } else {
            if (typeof showToast === 'function') showToast(data.message || 'Erro ao cancelar.', 'error');
        }
    } catch (error) {
        if (typeof showToast === 'function') showToast('Erro ao comunicar com o servidor.', 'error');
    }
}

async function handleCancelarMonitoria(monitoriaId, itemElement, token) {
    try {
        // PUT /monitorias/:id/cancelar
        const response = await fetch(`${MB_BETA_ORM}/monitorias/${monitoriaId}/cancelar`, {
            method:  'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            if (typeof showToast === 'function') showToast(data.message, 'success');

            // Atualiza o status visualmente sem recarregar a página
            const statusEl = itemElement.querySelector('.lista-item-info p:nth-child(2)');
            if (statusEl) {
                const partes = statusEl.innerHTML.split('—');
                statusEl.innerHTML = `${partes[0]}— <span class="status-cancelada" style="color:red;font-weight:bold;">CANCELADA</span>`;
            }
            const btn = itemElement.querySelector('.btn-cancelar');
            if (btn) btn.remove();
        } else {
            if (typeof showToast === 'function') showToast(data.message || 'Erro ao cancelar.', 'error');
        }
    } catch (error) {
        if (typeof showToast === 'function') showToast('Erro ao comunicar com o servidor.', 'error');
    }
}
