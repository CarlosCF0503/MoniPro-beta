// monipro-web/JS/marcar_monitoria.js
// Depende de: api.js (MB_BETA_ORM), toast.js (showToast), base.js, calendario.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. CONFIGURAÇÃO INICIAL ---
    const urlParams      = new URLSearchParams(window.location.search);
    const disciplinaID   = urlParams.get('disciplinaID');
    const disciplinaNome = urlParams.get('disciplinaNome');
    const token          = localStorage.getItem('monipro_token');

    if (!disciplinaID || !token) {
        if (typeof showToast === 'function') showToast('Informações inválidas. Redirecionando...', 'error');
        setTimeout(() => { window.location.href = 'base.html'; }, 1500);
        return;
    }

    // Elementos da UI
    const tituloPagina       = document.getElementById('titulo-pagina');
    const viewAluno          = document.getElementById('view-aluno');
    const viewMonitor        = document.getElementById('view-monitor');
    const containerMonitores = document.getElementById('lista-monitores');
    const btnAgendar         = document.getElementById('marcar-agendamento');
    const btnCriarMonitoria  = document.getElementById('criar-monitoria');

    // Estado
    let monitoriaSelecionada = null;
    let userData             = null;
    let todasAsMonitorias    = [];

    if (tituloPagina) tituloPagina.textContent = `Monitoria de ${disciplinaNome}`;

    // Decodifica token JWT
    try {
        userData = JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        localStorage.removeItem('monipro_token');
        window.location.href = 'index.html';
        return;
    }

    // --- 2. INICIALIZAR CALENDÁRIO (via calendario.js) ---

    // Callback chamado sempre que o mês muda (botões < >)
    function aoMudarMes(mesOffset) {
        // Recalcula quais dias do novo mês têm monitorias
        const hoje     = new Date();
        const baseData = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
        const mesAlvo  = baseData.getMonth();
        const anoAlvo  = baseData.getFullYear();

        const diasComMonitoria = calcularDiasComMonitoria(mesAlvo, anoAlvo);

        renderCalendario(diasComMonitoria, aoDiaClicar);

        // Limpa seleção ao mudar de mês
        monitoriaSelecionada = null;
        if (containerMonitores) {
            containerMonitores.innerHTML = '<p>Selecione um dia disponível (marcado a azul).</p>';
        }
    }

    // Callback chamado ao clicar num dia do calendário
    function aoDiaClicar(dia, mes, ano, td) {
        const temMonitoria = td.classList.contains('dia-com-monitoria');
        const ehPassado    = td.classList.contains('dia-passado');

        if (ehPassado) {
            if (typeof showToast === 'function') showToast('Não é possível selecionar dias passados.', 'error');
            return;
        }

        if (userData.tipo === 'aluno' && !temMonitoria) {
            if (typeof showToast === 'function') showToast('Nenhuma monitoria disponível neste dia.', 'error');
            if (containerMonitores) containerMonitores.innerHTML = '<p>Selecione um dia disponível (marcado a azul).</p>';
            monitoriaSelecionada = null;
            selecionarDia(null);
            return;
        }

        // Marca o dia visualmente
        selecionarDia(td);

        if (userData.tipo === 'aluno') {
            filtrarMonitoresPorDia(dia, mes, ano);

            // Auto-scroll em mobile
            if (window.innerWidth <= 900) {
                const areaMarcar = document.getElementById('view-aluno');
                if (areaMarcar) setTimeout(() => areaMarcar.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
            }
        }
        // Monitor: apenas seleciona o dia para usar no formulário
    }

    // Inicializa navegação (botões < >) — calendário.js
    iniciarNavegacaoCalendario(aoMudarMes);

    // --- 3. INICIALIZAÇÃO POR TIPO DE UTILIZADOR ---
    if (userData.tipo === 'aluno') {
        if (viewAluno)   viewAluno.style.display   = 'flex';
        if (viewMonitor) viewMonitor.style.display = 'none';
        await carregarMonitoriasParaAluno();
        if (btnAgendar) btnAgendar.addEventListener('click', salvarAgendamento);

    } else if (userData.tipo === 'monitor') {
        if (viewAluno)   viewAluno.style.display   = 'none';
        if (viewMonitor) viewMonitor.style.display = 'flex';
        // Monitor vê o calendário sem marcações de monitorias
        renderCalendario([], aoDiaClicar);
        if (btnCriarMonitoria) btnCriarMonitoria.addEventListener('click', salvarNovaMonitoria);
    }

    // --- 4. FUNÇÕES AUXILIARES ---

    function calcularDiasComMonitoria(mesAlvo, anoAlvo) {
        return [...new Set(
            todasAsMonitorias
                .filter(m => {
                    const d = new Date(m.horario);
                    return d.getMonth() === mesAlvo && d.getFullYear() === anoAlvo;
                })
                .map(m => new Date(m.horario).getDate())
        )];
    }

    // --- 5. FUNÇÕES DE API ---

    async function carregarMonitoriasParaAluno() {
        try {
            const response = await fetch(`${MB_BETA_ORM}/monitorias/${disciplinaID}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            // Backend retorna array puro; fallback defensivo
            const lista = Array.isArray(data) ? data : (data.monitorias || []);

            if (lista.length > 0) {
                todasAsMonitorias = lista;

                // Renderiza o mês atual com os dias que têm monitorias
                const hoje    = new Date();
                const diasCom = calcularDiasComMonitoria(hoje.getMonth(), hoje.getFullYear());
                renderCalendario(diasCom, aoDiaClicar);

                if (containerMonitores) {
                    containerMonitores.innerHTML = '<p>Selecione um dia azul no calendário.</p>';
                }
            } else {
                renderCalendario([], aoDiaClicar);
                if (containerMonitores) {
                    containerMonitores.innerHTML = '<p>Nenhum monitor disponível para esta disciplina.</p>';
                }
            }
        } catch (error) {
            console.error('Erro ao carregar monitorias:', error);
            if (typeof showToast === 'function') showToast('Erro ao carregar monitorias.', 'error');
            renderCalendario([], aoDiaClicar);
        }
    }

    function filtrarMonitoresPorDia(dia, mes, ano) {
        if (!containerMonitores) return;
        containerMonitores.innerHTML = '';
        monitoriaSelecionada = null;

        const lista = todasAsMonitorias.filter(m => {
            const d = new Date(m.horario);
            return d.getDate() === dia && d.getMonth() === mes && d.getFullYear() === ano;
        });

        if (lista.length === 0) {
            containerMonitores.innerHTML = '<p>Nenhuma monitoria encontrada para este dia.</p>';
            return;
        }

        lista.forEach(monitoria => {
            const horaFormatada = new Date(monitoria.horario)
                .toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const nomeMonitor = monitoria.monitor?.nome_completo || 'Monitor';
            const monId       = String(monitoria.id);

            const div = document.createElement('div');
            div.className = 'monitor-item';
            div.innerHTML = `
                <input type="radio" name="monitoriaEscolhida" value="${monId}" id="mon-${monId}" style="display:none;">
                <label for="mon-${monId}" style="cursor:pointer;width:100%;display:flex;align-items:center;gap:15px;">
                    <div class="icone"><img src="IMG/Icone_monitor.png" alt="Monitor"></div>
                    <div>
                        <strong>${nomeMonitor}</strong><br>
                        <small>Local: ${monitoria.local || 'A definir'}</small><br>
                        <small style="color:#071E3D;font-weight:bold;">Horário: ${horaFormatada}</small>
                    </div>
                </label>
            `;
            div.addEventListener('click', () => {
                document.querySelectorAll('.monitor-item.selecionado')
                    .forEach(m => m.classList.remove('selecionado'));
                div.classList.add('selecionado');
                const radio = div.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
                monitoriaSelecionada = monitoria;
            });

            containerMonitores.appendChild(div);
        });
    }

    async function salvarAgendamento() {
        if (!monitoriaSelecionada) {
            if (typeof showToast === 'function') showToast('Selecione um monitor da lista.', 'error');
            return;
        }
        try {
            const response = await fetch(`${MB_BETA_ORM}/agendamentos`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    id_monitoria: Number(monitoriaSelecionada.id),
                    data_hora:    monitoriaSelecionada.horario
                })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                if (btnAgendar) {
                    btnAgendar.classList.add('marcado');
                    btnAgendar.querySelector('p').textContent = 'Agendado!';
                }
                if (typeof showToast === 'function') showToast('Monitoria agendada com sucesso!', 'success');
                setTimeout(() => { window.location.href = 'base.html'; }, 2000);
            } else {
                if (typeof showToast === 'function') showToast(data.erro || 'Erro ao agendar.', 'error');
            }
        } catch (error) {
            if (typeof showToast === 'function') showToast('Não foi possível ligar ao servidor.', 'error');
        }
    }

    async function salvarNovaMonitoria() {
        const tdAtual   = getTdSelecionado();
        const dia       = tdAtual ? Number(tdAtual.dataset.dia) : null;
        const mes       = tdAtual ? Number(tdAtual.dataset.mes) : null;
        const ano       = tdAtual ? Number(tdAtual.dataset.ano) : null;
        const horaInput = document.getElementById('monitoria-horario')?.value;
        const local     = document.getElementById('monitoria-local')?.value.trim();
        const descricao = document.getElementById('monitoria-descricao')?.value.trim();

        if (!dia || !horaInput || !local) {
            if (typeof showToast === 'function') showToast('Selecione um dia, defina o horário e o local.', 'error');
            return;
        }

        const [horas, minutos] = horaInput.split(':').map(Number);
        const data_monitoria   = new Date(ano, mes, dia, horas, minutos, 0).toISOString();

        try {
            const response = await fetch(`${MB_BETA_ORM}/monitorias`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    id_disciplina: Number(disciplinaID),
                    horario:       data_monitoria,
                    local,
                    descricao:     descricao || ''
                })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                if (btnCriarMonitoria) {
                    btnCriarMonitoria.classList.add('marcado');
                    btnCriarMonitoria.querySelector('p').textContent = 'Vaga Criada!';
                }
                if (typeof showToast === 'function') showToast('Vaga de monitoria criada com sucesso!', 'success');
                setTimeout(() => { window.location.href = 'base.html'; }, 2000);
            } else {
                if (typeof showToast === 'function') showToast(data.erro || 'Erro ao criar vaga.', 'error');
            }
        } catch (error) {
            if (typeof showToast === 'function') showToast('Não foi possível ligar ao servidor.', 'error');
        }
    }
});
