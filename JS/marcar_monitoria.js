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
    let diaSelecionado = null; // Guarda o NÚMERO do dia (ex: 5)
    let monitoriaSelecionada = null; // Guarda o OBJETO da monitoria
    let userData = null;
    
    // <<<<< NOVO: Armazena todas as monitorias disponíveis
    let todasAsMonitorias = []; 

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
        coluna.dataset.dia = diaContador; // Adiciona um data-dia para facilitar a seleção

        if (diaContador === diaAtual && mesAtual === dataAtual.getMonth()) {
          coluna.classList.add('dia-atual');
        }
        
        // Destaca se o dia está na lista de dias com monitoria
        if (diasComMonitoria.includes(diaContador)) {
            coluna.classList.add('dia-com-monitoria');
        }

        linha.appendChild(coluna);
        diaContador++;
      }

      if (linha.children.length > 0) {
        tbody.appendChild(linha);
      }
    }

    // --- 3. LÓGICA DE SELEÇÃO DO CALENDÁRIO ---
    diasCalendario.addEventListener('click', (event) => {
        const celulaClicada = event.target.closest('td'); // Garante que pegamos o TD
        
        // Se o clique não foi numa célula de dia válida, não faz nada
        if (!celulaClicada || !celulaClicada.dataset.dia) {
            return;
        }

        // <<<<<<<<<<<< CORREÇÃO LÓGICA IMPORTANTE >>>>>>>>>>>>
        // Verifica se o dia clicado TEM monitoria
        if (userData.tipo === 'aluno') {
            if (!celulaClicada.classList.contains('dia-com-monitoria')) {
                showToast('Nenhuma monitoria disponível neste dia.', 'error');
                containerMonitores.innerHTML = '<p>Selecione um dia disponível no calendário.</p>';
                monitoriaSelecionada = null;
                if (diaSelecionado) {
                     diaSelecionado.classList.remove('dia-selecionado');
                }
                diaSelecionado = null;
                return; // Para a execução
            }
        }
        // <<<<<<<<<<<<<< FIM DA CORREÇÃO >>>>>>>>>>>>

        // Remove a seleção visual anterior
        if (diaSelecionado) {
            diaSelecionado.classList.remove('dia-selecionado');
        }
        
        // Adiciona a nova seleção visual
        diaSelecionado = celulaClicada;
        diaSelecionado.classList.add('dia-selecionado');

        // Filtra e exibe os monitores para este dia
        const diaNum = parseInt(diaSelecionado.dataset.dia);
        filtrarMonitoresPorDia(diaNum);
    });

    // --- 4. VERIFICA O TIPO DE UTILIZADOR E EXECUTA A LÓGICA ---
    if (userData.tipo === 'aluno') {
        // --- LÓGICA DE ALUNO ---
        viewAluno.style.display = 'flex';
        viewMonitor.style.display = 'none';
        await carregarMonitoriasParaAluno(); // Esta função agora SÓ carrega os dados
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
                // Guarda todas as monitorias na variável global
                todasAsMonitorias = data.monitorias;
                
                // Extrai os dias que têm vagas
                const datasDisponiveis = todasAsMonitorias.map(monitoria => {
                    return new Date(monitoria.horario).getDate();
                });
                const diasUnicos = [...new Set(datasDisponiveis)];
                
                // Renderiza o calendário COM os dias destacados
                renderCalendario(diasUnicos);
                
                // Limpa a lista de monitores (eles só aparecerão após o clique no dia)
                containerMonitores.innerHTML = '<p>Selecione um dia no calendário.</p>';

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

    // <<<<<<<<<<<< NOVA FUNÇÃO PARA FILTRAR MONITORES >>>>>>>>>>>>
    function filtrarMonitoresPorDia(diaNum) {
        containerMonitores.innerHTML = ''; // Limpa a lista
        monitoriaSelecionada = null; // Reseta a seleção

        // Filtra a lista principal de monitorias para o dia clicado
        const monitoresDoDia = todasAsMonitorias.filter(m => new Date(m.horario).getDate() == diaNum);

        if (monitoresDoDia.length === 0) {
            containerMonitores.innerHTML = '<p>Erro: Nenhuma monitoria encontrada para este dia.</p>';
            return;
        }

        // Cria os elementos HTML para os monitores encontrados
        monitoresDoDia.forEach(monitoria => {
            const div = document.createElement('div');
            div.className = 'monitor';
            
            const dataFormatada = new Date(monitoria.horario).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            div.innerHTML = `
                <div class="icone"><img src="IMG/Icone_monitor.png" alt=""></div>
                <p>${monitoria.nome_completo} (${dataFormatada})</p>
            `;
            
            div.addEventListener('click', () => {
                document.querySelectorAll('.monitor.selecionado').forEach(m => m.classList.remove('selecionado'));
                div.classList.add('selecionado');
                // Guarda o OBJETO INTEIRO da monitoria selecionada
                monitoriaSelecionada = monitoria; 
            });
            containerMonitores.appendChild(div);
        });
    }

    async function salvarAgendamento() {
    // Agora verificamos o objeto monitoriaSelecionada
    if (!monitoriaSelecionada) {
        showToast('Por favor, selecione um monitor da lista.', 'error');
        return;
    }
    
    // Os dados vêm diretamente do objeto selecionado, garantindo que estão corretos
    const id_monitoria_para_enviar = monitoriaSelecionada.monitoria_id;
    const data_agendamento_para_enviar = monitoriaSelecionada.horario; // Esta já é a data/hora exata

    try {
        const response = await fetch('https://monipro-beta.onrender.com/agendamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                id_monitoria: id_monitoria_para_enviar,
                data_agendamento: data_agendamento_para_enviar
            })
        });

        // ========================================================================= //
        // CORREÇÃO: Trata o erro 409 (Conflito) de forma específica
        // ========================================================================= //
        if (response.status === 409) {
            // Se o status for 409, o servidor enviou a mensagem de duplicidade.
            const errorData = await response.json();
            showToast(errorData.message, 'error'); // Exibe "Você já está inscrito..."
            return; // Para a execução
        }
        // ========================================================================= //

        const data = await response.json();
        
        if (data.success) {
            btnAgendar.classList.add('marcado');
            btnAgendar.querySelector('p').textContent = 'Agendado!';
            showToast('Monitoria agendada com sucesso!', 'success');
            setTimeout(() => window.location.href = 'base.html', 2000);
        } else {
            // Trata outros erros que podem vir do servidor
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

