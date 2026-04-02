// monipro-web/JS/calendario.js
// Módulo de calendário reutilizável — integrado com marcar_monitoria.js
// Exporta: renderCalendario(diasComMonitoria, mesOffset)
// Depende dos elementos: #mes-ano, #dias-calendario, #mes-anterior, #proximo-mes

(function () {
    const MESES = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril',
        'Maio', 'Junho', 'Julho', 'Agosto',
        'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // Offset de mês navegado pelo utilizador (0 = mês atual, 1 = próximo, -1 = anterior)
    let mesOffset = 0;

    /**
     * Renderiza o calendário no DOM.
     * @param {number[]} diasComMonitoria - Lista de dias (do mês exibido) que têm monitorias disponíveis.
     * @param {Function} onDiaClick - Callback chamado com (diaNum, mesExibido, anoExibido) ao clicar num dia.
     */
    window.renderCalendario = function (diasComMonitoria = [], onDiaClick = null) {
        const hoje       = new Date();
        const baseData   = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
        const mesExibido = baseData.getMonth();
        const anoExibido = baseData.getFullYear();
        const diaHoje    = hoje.getDate();
        const mesHoje    = hoje.getMonth();
        const anoHoje    = hoje.getFullYear();

        // Atualiza cabeçalho
        const headerEl = document.getElementById('mes-ano');
        if (headerEl) headerEl.textContent = `${MESES[mesExibido]} ${anoExibido}`;

        const primeiroDia = new Date(anoExibido, mesExibido, 1).getDay();
        const ultimoDia   = new Date(anoExibido, mesExibido + 1, 0).getDate();
        const tbody       = document.getElementById('dias-calendario');
        if (!tbody) return;

        tbody.innerHTML = '';
        let linha = document.createElement('tr');

        // Células vazias antes do primeiro dia
        for (let i = 0; i < primeiroDia; i++) {
            linha.appendChild(document.createElement('td'));
        }

        for (let dia = 1; dia <= ultimoDia; dia++) {
            if (linha.children.length === 7) {
                tbody.appendChild(linha);
                linha = document.createElement('tr');
            }

            const td        = document.createElement('td');
            td.textContent  = String(dia);
            td.dataset.dia  = String(dia);
            td.dataset.mes  = String(mesExibido);
            td.dataset.ano  = String(anoExibido);

            // Dia atual
            if (dia === diaHoje && mesExibido === mesHoje && anoExibido === anoHoje) {
                td.classList.add('dia-atual');
            }

            // Fim de semana
            const diaSemana = new Date(anoExibido, mesExibido, dia).getDay();
            if (diaSemana === 0 || diaSemana === 6) {
                td.classList.add('fim-de-semana');
            }

            // Dia com monitoria disponível
            if (diasComMonitoria.includes(dia)) {
                td.classList.add('dia-com-monitoria');
            }

            // Dias no passado ficam desabilitados
            const dataDoTd = new Date(anoExibido, mesExibido, dia);
            const dataHoje = new Date(anoHoje, mesHoje, diaHoje);
            if (dataDoTd < dataHoje) {
                td.classList.add('dia-passado');
            }

            if (typeof onDiaClick === 'function') {
                td.addEventListener('click', () => {
                    onDiaClick(dia, mesExibido, anoExibido, td);
                });
            }

            linha.appendChild(td);
        }

        if (linha.children.length > 0) tbody.appendChild(linha);
    };

    /**
     * Retorna o mesOffset atual (usado pelo marcar_monitoria.js para filtrar monitorias).
     */
    window.getMesOffset = function () { return mesOffset; };

    /**
     * Inicializa os botões de navegação do calendário.
     * @param {Function} onMudancaMes - Callback chamado após mudar o mês, recebe o novo mesOffset.
     */
    window.iniciarNavegacaoCalendario = function (onMudancaMes) {
        const btnAnterior = document.getElementById('mes-anterior');
        const btnProximo  = document.getElementById('proximo-mes');

        if (btnAnterior) {
            btnAnterior.addEventListener('click', () => {
                mesOffset--;
                if (typeof onMudancaMes === 'function') onMudancaMes(mesOffset);
            });
        }

        if (btnProximo) {
            btnProximo.addEventListener('click', () => {
                mesOffset++;
                if (typeof onMudancaMes === 'function') onMudancaMes(mesOffset);
            });
        }
    };

    /**
     * Marca um TD como selecionado e desmarca o anterior.
     */
    let tdSelecionado = null;
    window.selecionarDia = function (td) {
        if (tdSelecionado) tdSelecionado.classList.remove('dia-selecionado');
        tdSelecionado = td;
        if (td) td.classList.add('dia-selecionado');
    };

    window.getTdSelecionado = function () { return tdSelecionado; };

})();
