// JS/marcar/datas.js
// Funções puras da tela de marcar monitoria: datas, agrupamento de vagas e validação do
// formulário do monitor. Não tocam no DOM: as telas importam MarcarDatas, e o Jest testa as
// mesmas funções — ver tests/marcarDatas.test.js.

const MarcarDatas = (function () {
    const MESES = [
        'janeiro',
        'fevereiro',
        'março',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro'
    ];
    const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    // RN-001: cancelamento só com 24h de antecedência (src/utils/validarAntecedencia.js)
    const HORAS_CANCELAMENTO = 24;
    // Limites espelhados de src/schemas/monitoriaSchemas.js
    const LIMITE_LOCAL = 120;
    // Plano 11: link da sala on-line, as mesmas ferramentas aceitas pela API (src/utils/linkSala.js)
    const DOMINIOS_SALA = [
        'meet.google.com',
        'teams.microsoft.com',
        'teams.live.com',
        'zoom.us',
        'meet.jit.si'
    ];
    const LOCAL_ONLINE = 'On-line';

    function linkSalaValido(texto) {
        const bruto = String(texto || '').trim();
        if (!bruto || bruto.length > 500) return false;
        let url;
        try {
            url = new URL(bruto);
        } catch {
            return false;
        }
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
        const host = url.hostname.toLowerCase();
        return DOMINIOS_SALA.some((d) => host === d || host.endsWith('.' + d));
    }
    const LIMITE_DESCRICAO = 500;
    // Lista de horários do formulário do monitor (validada pelo time): 07:00 a 22:00, de 15 em 15
    const HORARIO_INICIO = 7 * 60;
    const HORARIO_FIM = 22 * 60;
    const HORARIO_PASSO = 15;

    /** Chave AAAA-MM-DD no fuso local (o calendário trabalha com o dia do usuário). */
    function chave(data) {
        return (
            data.getFullYear() +
            '-' +
            String(data.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(data.getDate()).padStart(2, '0')
        );
    }

    function deChave(k) {
        const [ano, mes, dia] = k.split('-').map(Number);
        return new Date(ano, mes - 1, dia);
    }

    function inicioDoDia(data) {
        return new Date(data.getFullYear(), data.getMonth(), data.getDate());
    }

    /** Dia inteiro anterior a hoje (hoje ainda é selecionável). */
    function diaPassado(data, agora) {
        return inicioDoDia(data) < inicioDoDia(agora);
    }

    function hora(data) {
        return (
            String(data.getHours()).padStart(2, '0') +
            ':' +
            String(data.getMinutes()).padStart(2, '0')
        );
    }

    function diaLongo(data) {
        return data.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }

    function diaCurto(data) {
        return data
            .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
            .split('.')
            .join('');
    }

    function plural(n, singular, pluralTexto) {
        return n + ' ' + (n === 1 ? singular : pluralTexto);
    }

    function iniciais(nome) {
        const partes = String(nome || '')
            .trim()
            .split(' ')
            .filter(Boolean);
        if (!partes.length) return '?';
        const primeira = partes[0][0];
        const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
        return (primeira + ultima).toUpperCase();
    }

    /** Último momento em que o aluno ainda pode cancelar a inscrição. */
    function prazoCancelamento(inicio) {
        return new Date(inicio.getTime() - HORAS_CANCELAMENTO * 60 * 60 * 1000);
    }

    function mesVizinho(ano, mes, delta) {
        const d = new Date(ano, mes + delta, 1);
        return { ano: d.getFullYear(), mes: d.getMonth() };
    }

    /**
     * Converte uma vaga da API (GET /monitorias/:idDisciplina) para o formato da tela.
     * @param {object} m - monitoria com horario ISO, capacidade, vagas_disponiveis, monitor.
     */
    function normalizarVaga(m) {
        const capacidade = Number(m.capacidade) || 1;
        const livres = Number.isFinite(Number(m.vagas_disponiveis))
            ? Math.max(Number(m.vagas_disponiveis), 0)
            : capacidade;
        return {
            id: Number(m.id),
            inicio: new Date(m.horario),
            monitor: (m.monitor && m.monitor.nome_completo) || 'Monitor',
            idMonitor: Number(m.id_monitor),
            local: m.local || '',
            descricao: m.descricao || '',
            capacidade,
            livres,
            // Plano 11: presencial ou on-line (o link nunca vem na listagem)
            modalidade: m.modalidade === 'online' ? 'online' : 'presencial',
            // Plano 8: lista de espera da vaga lotada
            naFila: Number(m.na_fila) || 0,
            filaCheia: Boolean(m.fila_cheia)
        };
    }

    /** Plano 8: vaga lotada em que ainda dá para entrar na lista de espera. */
    function aceitaFila(v) {
        return v.livres <= 0 && !v.filaCheia;
    }

    /** Só vagas que ainda vão acontecer, em ordem de horário. */
    function vagasFuturas(vagas, agora) {
        return vagas.filter((v) => v.inicio > agora).sort((a, b) => a.inicio - b.inicio);
    }

    // Plano 13 (RF-017): turnos pela hora de início mostrada na tela. Mesmas faixas da API
    // (src/config/turnos.js): manhã até 11:59, tarde de 12:00 a 17:59, noite a partir das 18:00.
    const TURNOS = [
        ['manha', 'Manhã'],
        ['tarde', 'Tarde'],
        ['noite', 'Noite']
    ];
    const FILTROS_VAZIOS = Object.freeze({ periodo: '', monitor: '', livres: false });

    function turno(data) {
        const h = data.getHours();
        if (h < 12) return 'manha';
        return h < 18 ? 'tarde' : 'noite';
    }

    function filtrosAtivos(f) {
        return Boolean(f && (f.periodo || f.monitor || f.livres));
    }

    /** Vagas que passam nos filtros { periodo, monitor (id em texto), livres }. */
    function filtrarVagas(vagas, f) {
        if (!filtrosAtivos(f)) return vagas;
        return vagas.filter(
            (v) =>
                (!f.periodo || turno(v.inicio) === f.periodo) &&
                (!f.monitor || String(v.idMonitor) === String(f.monitor)) &&
                (!f.livres || v.livres > 0)
        );
    }

    /** Monitores das vagas, sem repetir, em ordem alfabética: [{ id, nome }]. */
    function monitoresDe(vagas) {
        const vistos = new Map();
        vagas.forEach((v) => {
            if (!vistos.has(v.idMonitor)) vistos.set(v.idMonitor, v.monitor);
        });
        return Array.from(vistos, ([id, nome]) => ({ id, nome })).sort((a, b) =>
            a.nome.localeCompare(b.nome, 'pt-BR')
        );
    }

    function vagasDoDia(vagas, k) {
        return vagas.filter((v) => chave(v.inicio) === k);
    }

    /** Quantidade de vagas por dia (chave → número). */
    function contarPorDia(vagas) {
        const contagem = {};
        vagas.forEach((v) => {
            const k = chave(v.inicio);
            contagem[k] = (contagem[k] || 0) + 1;
        });
        return contagem;
    }

    /** Junta "AAAA-MM-DD" e "HH:MM" em uma data local; null se faltar o dia. */
    function dataDoFormulario(diaChave, horaTexto) {
        if (!diaChave) return null;
        const data = deChave(diaChave);
        const [h, m] = String(horaTexto || '00:00')
            .split(':')
            .map(Number);
        data.setHours(h || 0, m || 0, 0, 0);
        return data;
    }

    /**
     * Horários oferecidos na lista ("HH:MM"). Um valor fora da grade (ex.: 18:10, de uma vaga
     * antiga) entra na posição certa para não se perder.
     */
    function horarios(atual) {
        const lista = [];
        for (let m = HORARIO_INICIO; m <= HORARIO_FIM; m += HORARIO_PASSO) {
            lista.push(
                String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
            );
        }
        if (atual && !lista.includes(atual)) {
            lista.push(atual);
            lista.sort();
        }
        return lista;
    }

    /**
     * Valida o formulário de nova vaga com as mesmas regras de monitoriaSchemas.js, mais o
     * conflito de horário com outra vaga do mesmo monitor no dia (só o front verifica hoje).
     * @returns {object} campo → mensagem; vazio quando está tudo certo.
     */
    // Plano 9 (RF-014): vaga que se repete toda semana até um dia, no máximo 16 de uma vez.
    // Mesmas regras da API (src/utils/recorrencia.js).
    const MAX_OCORRENCIAS = 16;

    /** Datas da série: a cada 7 dias, mesmo horário, até o dia `ate` ("AAAA-MM-DD"). Para em 17. */
    function ocorrencias(inicio, ate) {
        const lista = [];
        for (let k = 0; lista.length <= MAX_OCORRENCIAS; k += 1) {
            const d = new Date(inicio);
            d.setDate(d.getDate() + 7 * k);
            if (chave(d) > ate) break;
            lista.push(d);
        }
        return lista;
    }

    /** Dia que fica `semanas` semanas depois de `k`, como chave. */
    function somarSemanas(k, semanas) {
        const d = deChave(k);
        d.setDate(d.getDate() + 7 * semanas);
        return chave(d);
    }

    /**
     * Série do formulário: datas, as que serão puladas (o monitor já tem vaga no mesmo horário) e
     * as que serão criadas. null quando não repete ou falta dia, horário ou data final.
     */
    function serieDoForm(form, minhas) {
        if (!form.repetir || !form.ate || !form.hora) return null;
        const inicio = dataDoFormulario(form.dia, form.hora);
        if (!inicio || form.ate < form.dia) return null;
        const datas = ocorrencias(inicio, form.ate);
        const ocupadas = new Set((minhas || []).map((v) => v.inicio.getTime()));
        return {
            datas,
            puladas: datas.filter((d) => ocupadas.has(d.getTime())),
            criadas: datas.filter((d) => !ocupadas.has(d.getTime()))
        };
    }

    /** "24/11" */
    function diaMes(d) {
        return (
            String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
        );
    }

    /** "Toda terça-feira" / "Todo sábado" */
    function todaSemana(d) {
        const nome = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        return (d.getDay() === 0 || d.getDay() === 6 ? 'Todo ' : 'Toda ') + nome;
    }

    function validarVaga(form, agora, minhasNoDia) {
        const erros = {};
        const data = dataDoFormulario(form.dia, form.hora);
        if (!data) erros.dia = 'Escolha o dia no calendário.';
        if (!form.hora) erros.hora = 'Informe o horário.';
        else if (data && data <= agora) erros.hora = 'O horário precisa estar no futuro.';
        else if (data && (minhasNoDia || []).some((v) => hora(v.inicio) === form.hora))
            erros.hora = 'Você já tem uma vaga às ' + form.hora + ' neste dia.';

        if (form.modalidade === 'online') {
            if (!String(form.link || '').trim()) erros.link = 'Informe o link da sala.';
            else if (!linkSalaValido(form.link))
                erros.link = 'Use um link https do Meet, Teams, Zoom ou Jitsi.';
        } else {
            const local = String(form.local || '').trim();
            if (!local) erros.local = 'O local é obrigatório.';
            else if (local.length > LIMITE_LOCAL)
                erros.local = 'Máximo de ' + LIMITE_LOCAL + ' caracteres.';
        }

        if (form.repetir) {
            if (!form.ate) erros.ate = 'Escolha até quando a vaga se repete.';
            else if (form.dia && form.ate < form.dia)
                erros.ate = 'A data final não pode ser antes do dia da vaga.';
            else if (data && ocorrencias(data, form.ate).length > MAX_OCORRENCIAS)
                erros.ate =
                    'No máximo ' +
                    MAX_OCORRENCIAS +
                    ' vagas de uma vez. Escolha uma data final mais próxima.';
        }

        if (String(form.descricao || '').length > LIMITE_DESCRICAO)
            erros.descricao = 'Máximo de ' + LIMITE_DESCRICAO + ' caracteres.';

        const capacidade = Number(form.capacidade);
        if (
            String(form.capacidade).trim() === '' ||
            !Number.isInteger(capacidade) ||
            capacidade < 1
        )
            erros.capacidade = 'Número inteiro, mínimo 1.';
        return erros;
    }

    const api = {
        MAX_OCORRENCIAS,
        ocorrencias,
        somarSemanas,
        serieDoForm,
        diaMes,
        todaSemana,
        MESES,
        DIAS_SEMANA,
        LIMITE_DESCRICAO,
        LOCAL_ONLINE,
        linkSalaValido,
        chave,
        deChave,
        diaPassado,
        hora,
        diaLongo,
        diaCurto,
        plural,
        iniciais,
        prazoCancelamento,
        mesVizinho,
        normalizarVaga,
        aceitaFila,
        TURNOS,
        FILTROS_VAZIOS,
        turno,
        filtrosAtivos,
        filtrarVagas,
        monitoresDe,
        vagasFuturas,
        vagasDoDia,
        contarPorDia,
        dataDoFormulario,
        horarios,
        validarVaga
    };

    return api;
})();

export { MarcarDatas };
