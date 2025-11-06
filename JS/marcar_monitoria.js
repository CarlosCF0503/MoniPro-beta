document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. SETUP INICIAL ---
    const urlParams = new URLSearchParams(window.location.search);
    const disciplinaID = urlParams.get('disciplinaID');
    const disciplinaNome = urlParams.get('disciplinaNome');
    const token = localStorage.getItem('monipro_token');

    // Elementos da UI
    const diasCalendario = document.getElementById('dias-calendario');
    const tituloPagina = document.getElementById('titulo-pagina');
    
    // UI Aluno
    const viewAluno = document.getElementById('view-aluno');
    const containerMonitores = document.getElementById('lista-monitores');
    const btnAgendar = document.getElementById('marcar-agendamento');
    
    // UI Monitor
    const viewMonitor = document.getElementById('view-monitor');
    const btnCriarMonitoria = document.getElementById('criar-monitoria');

    // Variáveis de estado
    let diaSelecionado = null;
    let monitoriaSelecionada = null; // Guarda o ID da monitoria
    let userData = null;

    if (!disciplinaID || !token) {
        showToast('Erro: Informações inválidas.', 'error');
        window.location.href = 'base.html';
        return;
    }
    
    if(tituloPagina) tituloPagina.textContent = `Monitoria de ${disciplinaNome}`;

    // Decodifica o token para saber quem é o utilizador
    try {
        userData = JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        localStorage.removeItem('monipro_token');
        window.location.href = 'index.html';
        return;
    }

    // --- 2. LÓGICA DO CALENDÁRIO (Fundida do calendario.js) ---
    
    function getNomeMes(mes) {
      const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      return meses[mes];
    }

    /**
     * Renderiza o calendário, destacando os dias com monitoria.
     * @param {number[]} [diasComMonitoria=[]] - Um array de números (dias) que têm monitorias.
     */
    function renderCalendario(diasComMonitoria = []) {
      const dataAtual = new Date();
      const mesAtual = dataAtual.getMonth();
      const anoAtual = dataAtual.getFullYear();
      const diaAtual = dataAtual.getDate();

      const headerElement = document.getElementById('mes-ano');
      headerElement.textContent = `${getNomeMes(mesAtual)} ${anoAtual}`;

      const primeiroDiaDoMes = new Date(anoAtual, mesAtual, 1).getDay();
      const ultimoDiaDoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();

      const tbody = document.getElementById('dias-calendario');
      tbody.innerHTML = ''; 
      let linha = document.createElement('tr');
      let diaContador = 1;

      for (let i = 0; i < primeiroDiaDoMes; i++) {
        linha.appendChild(document.createElement('td'));
      }

      while (diaContador <= ultimoDiaDoMes) {
        if (linha.children.length === 7) {
          tbody.appendChild(linha);
          linha = document.createElement('tr');
        }

        const coluna = document.createElement('td');
        coluna.textContent = diaContador;

        // Marca o dia atual
        if (diaContador === diaAtual && mesAtual === dataAtual.getMonth()) {
          coluna.classList.add('dia-atual');
        }
        
        // <<<<<<<<<<<< ATUALIZAÇÃO IMPORTANTE >>>>>>>>>>>>
        // Destaca se o dia está na lista de dias com monitoria
        if (diasComMonitoria.includes(diaContador)) {
            coluna.classList.add('dia-com-monitoria');
        }
        // <<<<<<<<<<<<<< FIM DA ATUALIZAÇÃO >>>>>>>>>>>>

        linha.appendChild(coluna);
        diaContador++;
      }

      if (linha.children.length > 0) {
        tbody.appendChild(linha);
      }
    }

    // --- 3. LÓGICA DE SELEÇÃO DO CALENDÁRIO (Comum a ambos) ---
    diasCalendario.addEventListener('click', (event) => {
        if (event.target.tagName === 'TD' && event.target.textContent) {
            if (diaSelecionado) {
                diaSelecionado.classList.remove('dia-selecionado');
            }
            diaSelecionado = event.target;
            diaSelecionado.classList.add('dia-selecionado');
        }
    });

    // --- 4. VERIFICA O TIPO DE UTILIZADOR E EXECUTA A LÓGICA ---
    if (userData.tipo === 'aluno') {
        // --- LÓGICA DE ALUNO ---
        viewAluno.style.display = 'flex';
        viewMonitor.style.display = 'none';
        await carregarMonitoriasParaAluno(); // Esta função agora também chama o renderCalendario
        btnAgendar.addEventListener('click', salvarAgendamento);

    } else if (userData.tipo === 'monitor') {
        // --- LÓGICA DE MONITOR ---
        viewAluno.style.display = 'none';
        viewMonitor.style.display = 'flex';
        renderCalendario(); // Renderiza um calendário simples para o monitor
        btnCriarMonitoria.addEventListener('click', salvarNovaMonitoria);
    }

    // --- 5. FUNÇÕES DE LÓGICA ---
    
    async function carregarMonitoriasParaAluno() {
        try {
            const response = await fetch(`https://monipro-beta.onrender.com/monitorias/${disciplinaID}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.monitorias.length > 0) {
                containerMonitores.innerHTML = '';
                
                // <<<<<<<<<<<< ATUALIZAÇÃO IMPORTANTE >>>>>>>>>>>>
                // Mapeia os dias que têm monitorias
                const datasDisponiveis = data.monitorias.map(monitoria => {
                    // Converte a data (ex: "2025-11-15T14:00:00Z") para um dia do mês (ex: 15)
                    return new Date(monitoria.horario).getDate();
                });
                
                // Filtra para ter apenas dias únicos
                const diasUnicos = [...new Set(datasDisponiveis)];
                
                // Agora, renderiza o calendário com os dias destacados
                renderCalendario(diasUnicos);
                // <<<<<<<<<<<<<< FIM DA ATUALIZAÇÃO >>>>>>>>>>>>
                
                data.monitorias.forEach(monitoria => {
                    const div = document.createElement('div');
                    div.className = 'monitor';
                    div.dataset.monitoriaId = monitoria.monitoria_id; 
                    
                    // Mostra a data e hora da monitoria
                    const dataFormatada = new Date(monitoria.horario).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    
                    div.innerHTML = `
                        <div class="icone"><img src="IMG/Icone_monitor.png" alt=""></div>
                        <p>${monitoria.nome_completo} (${dataFormatada})</p>
                    `;
                    
                    div.addEventListener('click', () => {
                        document.querySelectorAll('.monitor.selecionado').forEach(m => m.classList.remove('selecionado'));
                        div.classList.add('selecionado');
                        monitoriaSelecionada = monitoria.monitoria_id;
                    });
                    containerMonitores.appendChild(div);
                });
            } else {
                containerMonitores.innerHTML = '<p>Nenhum monitor disponível para esta disciplina.</p>';
                renderCalendario(); // Renderiza calendário vazio
            }
        } catch (error) {
            console.error('Erro ao buscar monitorias:', error);
            showToast('Erro ao carregar monitorias.', 'error');
            renderCalendario(); // Renderiza calendário vazio
        }
    }

    async function salvarAgendamento() {
        if (!diaSelecionado || !monitoriaSelecionada) {
            showToast('Por favor, selecione uma data e um monitor.', 'error');
            return;
        }
        
        // (No futuro, esta lógica precisa ser mais complexa. Por agora, está ok)
        const dataAtual = new Date();
        const data_agendamento = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), diaSelecionado.textContent, 14, 0, 0).toISOString(); // Horário fixo 14:00

        try {
            const response = await fetch('https://monipro-beta.onrender.com/agendamento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    id_monitoria: monitoriaSelecionada,
                    data_agendamento: data_agendamento
                })
            });
            const data = await response.json();
            if (data.success) {
                btnAgendar.classList.add('marcado');
                btnAgendar.querySelector('p').textContent = 'Agendado!';
                showToast('Monitoria agendada com sucesso!', 'success');
                setTimeout(() => window.location.href = 'base.html', 2000);
            } else {
                showToast(data.message || 'Erro ao agendar monitoria.', 'error');
            }
        } catch (error) {
            console.error('Erro ao agendar:', error);
            showToast('Não foi possível conectar ao servidor.', 'error');
        }
    }

    async function salvarNovaMonitoria() {
        const dia = diaSelecionado ? diaSelecionado.textContent : null;
        const hora = document.getElementById('monitoria-horario').value;
        const local = document.getElementById('monitoria-local').value;
        const descricao = document.getElementById('monitoria-descricao').value;

        if (!dia || !hora || !local) {
            showToast('Por favor, selecione um dia, defina um horário e um local.', 'error');
            return;
        }

        const [horas, minutos] = hora.split(':');
        const dataAtual = new Date();
        const data_monitoria = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dia, horas, minutos, 0).toISOString();

        try {
            const response = await fetch('https://monipro-beta.onrender.com/monitoria', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    id_disciplina: disciplinaID,
                    horario: data_monitoria,
                    local: local,
                    descricao: descricao
                })
            });
            const data = await response.json();
            if (data.success) {
                btnCriarMonitoria.classList.add('marcado');
                btnCriarMonitoria.querySelector('p').textContent = 'Vaga Criada!';
                showToast('Vaga de monitoria criada com sucesso!', 'success');
                setTimeout(() => window.location.href = 'base.html', 2000);
            } else {
                showToast(data.message || 'Erro ao criar vaga.', 'error');
            }
        } catch (error) {
            console.error('Erro ao criar vaga:', error);
            showToast('Não foi possível conectar ao servidor.', 'error');
        }
    }
});
