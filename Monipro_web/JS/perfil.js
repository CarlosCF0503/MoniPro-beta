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
                data.user.nome_completo || 'Utilizador';
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
    // 2. RENDERIZAR LISTAS POR TIPO DE UTILIZADOR
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
                        'Tem a certeza que deseja cancelar a sua inscrição nesta monitoria?'
                    );
                }
            });
        }
    } else if (userData.tipo === 'monitor') {
        const btnCertificados = document.getElementById('btn-certificados');
        if (btnCertificados) btnCertificados.style.display = 'flex';

        // Painel de certificados
        const verCertificadosBtn = document.getElementById('abrir_c');
        const fecharCertBtn = document.getElementById('fechar_c');
        const certificadosArea = document.getElementById('area_certificados');
        const overlayCert = document.getElementById('overlay-cert');

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

        // Lógica do Container de Monitorias
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
                if (event.target.classList.contains('btn-finalizar')) {
                    const { monitoriaId, horario, disciplina } = event.target.dataset;
                    abrirFinalizacao({ monitoriaId, horario, disciplina }, container);
                }
            });
            configurarModalFinalizacao(container);
        }
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

async function carregarMonitoriasCriadas(container) {
    try {
        const data = await chamadaApi('/perfil/monitorias');
        const lista = data.monitorias || [];

        if (!data.erro && lista.length > 0) {
            container.innerHTML = '';
            lista.forEach((m) => {
                const dataFormatada = new Date(m.horario).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                });
                const nomeDisciplina = escaparHtml(m.disciplina?.nome || 'Disciplina Indefinida');
                const statusStr = escaparHtml(m.status);
                const ativa = ['ativa', 'pendente'].includes(statusStr.toLowerCase());

                const dataFimFormatada = m.data_fim
                    ? new Date(m.data_fim).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                      })
                    : null;

                const div = document.createElement('div');
                div.className = 'lista-item';
                div.innerHTML = `
                    <div class="lista-item-info">
                        <p><strong>${nomeDisciplina}</strong> (${escaparHtml(m.local || 'Local Indefinido')})</p>
                        <p>${dataFormatada}${dataFimFormatada ? ` até ${dataFimFormatada}` : ''} — <span class="status-${statusStr.toLowerCase()}">${statusStr.toUpperCase()}</span></p>
                    </div>
                    ${
                        ativa
                            ? `<div class="lista-item-acoes">
                                <button class="btn-finalizar"
                                    data-monitoria-id="${escaparHtml(m.id)}"
                                    data-horario="${escaparHtml(m.horario)}"
                                    data-disciplina="${escaparHtml(m.disciplina?.nome || 'Disciplina Indefinida')}">Finalizar</button>
                                <button class="btn-cancelar" data-monitoria-id="${escaparHtml(m.id)}">Cancelar Vaga</button>
                            </div>`
                            : `<span class="status-${statusStr.toLowerCase()}">${statusStr.toUpperCase()}</span>`
                    }
                `;
                container.appendChild(div);
            });
        } else if (data.erro) {
            const msg = mensagemDaApi(data, 'Erro ao carregar as suas monitorias.');
            container.innerHTML = `<p style="color:#D8000C;">Falha do servidor: ${escaparHtml(msg)}</p>`;
            console.error('[MoniPro]', msg, data);
        } else {
            container.innerHTML = '<p>Ainda não criou nenhuma vaga de monitoria.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Erro ao carregar as suas monitorias.</p>';
        console.error('[MoniPro] Erro ao carregar as suas monitorias.', error);
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

async function handleCancelarMonitoria(monitoriaId, itemElement) {
    try {
        const data = await chamadaApi(`/monitorias/${monitoriaId}/cancelar`, { method: 'PUT' });
        if (!data.erro && data.success) {
            // Antes lia data.message, que o backend não envia: o toast de sucesso saía vazio
            if (typeof showToast === 'function')
                showToast(
                    mensagemDaApi(data, 'Vaga de monitoria cancelada com sucesso.'),
                    'success'
                );
            const statusEl = itemElement.querySelector('.lista-item-info p:nth-child(2)');
            if (statusEl) {
                const partes = statusEl.innerHTML.split('—');
                statusEl.innerHTML = `${partes[0]}— <span class="status-cancelada" style="color:red;font-weight:bold;">CANCELADA</span>`;
            }
            const btn = itemElement.querySelector('.btn-cancelar');
            if (btn) btn.remove();
            const btnFin = itemElement.querySelector('.btn-finalizar');
            if (btnFin) btnFin.remove();
        } else if (typeof showToast === 'function') {
            // Antes ignorava data.erro e mostrava sempre a mensagem genérica
            showToast(mensagemDaApi(data, 'Erro ao cancelar.'), 'error', data);
        }
    } catch (error) {
        if (typeof showToast === 'function') showToast('Erro de rede.', 'error', error);
    }
}

// ==========================================
// FINALIZAÇÃO DE MONITORIA (monitor)
// ==========================================

// Converte uma data em "YYYY-MM-DDTHH:mm" no fuso local — formato do <input type="datetime-local">
function paraInputLocal(data) {
    const d = new Date(data);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let finalizacaoAtual = null;

function abrirFinalizacao(dados, container) {
    const modal = document.getElementById('modal-finalizar');
    const overlay = document.getElementById('overlay');
    if (!modal || !overlay) return;

    finalizacaoAtual = { ...dados, container };
    const inicio = paraInputLocal(dados.horario);

    document.getElementById('finalizar-disciplina').textContent = dados.disciplina;
    document.getElementById('finalizar-inicio').value = inicio;

    const campoFim = document.getElementById('finalizar-fim');
    campoFim.min = inicio; // o seletor já bloqueia datas anteriores ao início
    campoFim.value = '';
    campoFim.classList.remove('invalido');

    document.getElementById('finalizar-erro').textContent = '';

    overlay.classList.add('active');
    modal.classList.add('aparecer');
    campoFim.focus();
}

function fecharFinalizacao() {
    document.getElementById('modal-finalizar')?.classList.remove('aparecer');
    document.getElementById('overlay')?.classList.remove('active');
    finalizacaoAtual = null;
}

function configurarModalFinalizacao(container) {
    const btnConfirmar = document.getElementById('btnFinalizarConfirmar');
    const btnVoltar = document.getElementById('btnFinalizarCancelar');
    const campoFim = document.getElementById('finalizar-fim');
    const erro = document.getElementById('finalizar-erro');

    if (!btnConfirmar || !btnVoltar || !campoFim) return;

    const mostrarErro = (mensagem) => {
        erro.textContent = mensagem;
        campoFim.classList.add('invalido');
    };

    btnVoltar.addEventListener('click', fecharFinalizacao);

    btnConfirmar.addEventListener('click', async () => {
        if (!finalizacaoAtual) return;

        erro.textContent = '';
        campoFim.classList.remove('invalido');

        if (!campoFim.value) {
            mostrarErro('Informe a data e hora de término.');
            return;
        }

        const fim = new Date(campoFim.value);

        if (fim.getTime() < new Date(finalizacaoAtual.horario).getTime()) {
            mostrarErro('A data de término não pode ser anterior ao início da monitoria.');
            return;
        }

        btnConfirmar.disabled = true;
        try {
            const data = await chamadaApi(`/monitorias/${finalizacaoAtual.monitoriaId}/finalizar`, {
                method: 'PATCH',
                body: JSON.stringify({ data_fim: fim.toISOString() })
            });

            if (!data.erro && data.success) {
                if (typeof showToast === 'function')
                    showToast(mensagemDaApi(data, 'Monitoria finalizada com sucesso.'), 'success');
                fecharFinalizacao();
                await carregarMonitoriasCriadas(container);
            } else {
                const msg = mensagemDaApi(data, 'Não foi possível finalizar a monitoria.');
                mostrarErro(msg);
                console.error('[MoniPro]', msg, data);
            }
        } catch (error) {
            mostrarErro('Erro de rede. Tente novamente.');
            console.error('[MoniPro] Erro de rede ao finalizar a monitoria.', error);
        } finally {
            btnConfirmar.disabled = false;
        }
    });
}
