// JS/perfil/dados.js
// Funções puras do perfil do monitor: classificação das vagas, horas comprovadas, regra de
// cancelamento e opções de término. Não tocam no DOM, então rodam no navegador (global
// PerfilDados) e no Jest (module.exports) — ver tests/perfilDados.test.js.
/* global module */

(function (raiz) {
    const MESES = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro'
    ];
    const MESES_CURTOS = [
        'jan',
        'fev',
        'mar',
        'abr',
        'mai',
        'jun',
        'jul',
        'ago',
        'set',
        'out',
        'nov',
        'dez'
    ];
    const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

    // RN-001: o backend só aceita cancelar com no mínimo 24h de antecedência
    const HORAS_CANCELAMENTO = 24;
    // Término oferecido ao finalizar: de 15 em 15 minutos, até 4h depois do início
    const TERMINO_PASSO = 15;
    const TERMINO_MAXIMO = 240;

    // P2 (R4) e D1: o monitor confirma a presença depois do início da sessão, em até 7 dias,
    // e cada confirmação vale +10 pontos para ele e +2 para o aluno (as mesmas regras da API)
    const DIAS_CONFIRMACAO = 7;
    const PONTOS_MONITOR = 10;
    const PONTOS_ALUNO = 2;
    const MS_DIA = 24 * 60 * 60 * 1000;

    const ATIVAS = ['ativa', 'pendente'];
    const REALIZADAS = ['realizada', 'concluida'];

    const pad = (n) => String(n).padStart(2, '0');

    function hora(data) {
        return pad(data.getHours()) + ':' + pad(data.getMinutes());
    }
    function diaMes(data) {
        return pad(data.getDate()) + '/' + pad(data.getMonth() + 1);
    }
    function diaCurto(data) {
        return (
            DIAS_SEMANA[data.getDay()] +
            ', ' +
            pad(data.getDate()) +
            ' ' +
            MESES_CURTOS[data.getMonth()]
        );
    }

    /** 90 -> "1h30", 60 -> "1h", 45 -> "45min" */
    function duracao(minutos) {
        const total = Math.max(0, Math.round(minutos));
        const h = Math.floor(total / 60);
        const m = total % 60;
        if (!h) return m + 'min';
        return h + 'h' + (m ? pad(m) : '');
    }

    function iniciais(nome) {
        const partes = String(nome || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (!partes.length) return '?';
        const primeira = partes[0][0];
        const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
        return (primeira + ultima).toUpperCase();
    }

    /**
     * Converte uma monitoria de GET /perfil/monitorias no formato da tela.
     * `inscritos` fica null quando a API ainda não manda o campo.
     */
    function normalizar(m) {
        return {
            id: m.id,
            disciplina: (m.disciplina && m.disciplina.nome) || 'Disciplina',
            local: m.local || 'Local a definir',
            inicio: new Date(m.horario),
            fim: m.data_fim ? new Date(m.data_fim) : null,
            status: String(m.status || '').toLowerCase(),
            capacidade: Number(m.capacidade) || 1,
            inscritos: Number.isInteger(m.inscritos) ? m.inscritos : null
        };
    }

    /** 'finalizar' (ativa e já começou) | 'proximas' (ativa e futura) | 'historico' */
    function grupo(vaga, agora) {
        if (ATIVAS.includes(vaga.status)) return vaga.inicio < agora ? 'finalizar' : 'proximas';
        return 'historico';
    }

    /** Separa nas três listas da tela: próximas em ordem de data, histórico do mais recente. */
    function separar(vagas, agora) {
        const finalizar = [];
        const proximas = [];
        const historico = [];
        vagas.forEach((v) => {
            const g = grupo(v, agora);
            if (g === 'finalizar') finalizar.push(v);
            else if (g === 'proximas') proximas.push(v);
            else historico.push(v);
        });
        finalizar.sort((a, b) => a.inicio - b.inicio);
        proximas.sort((a, b) => a.inicio - b.inicio);
        historico.sort((a, b) => b.inicio - a.inicio);
        return { finalizar, proximas, historico };
    }

    function realizada(vaga) {
        return REALIZADAS.includes(vaga.status);
    }

    function minutosDaVaga(vaga) {
        if (!realizada(vaga) || !vaga.fim) return 0;
        return Math.max(0, (vaga.fim - vaga.inicio) / 60000);
    }

    /** Minutos de monitorias finalizadas (data_fim - horario). */
    function minutosComprovados(vagas) {
        return vagas.reduce((soma, v) => soma + minutosDaVaga(v), 0);
    }

    /** [{ disciplina, minutos }] das finalizadas, da que tem mais horas para a que tem menos. */
    function horasPorDisciplina(vagas) {
        const mapa = new Map();
        vagas.forEach((v) => {
            const min = minutosDaVaga(v);
            if (min > 0) mapa.set(v.disciplina, (mapa.get(v.disciplina) || 0) + min);
        });
        return Array.from(mapa, ([disciplina, minutos]) => ({ disciplina, minutos })).sort(
            (a, b) => b.minutos - a.minutos
        );
    }

    /** RN-001: só vagas futuras com 24h ou mais até o início podem ser canceladas. */
    function podeCancelar(vaga, agora) {
        if (grupo(vaga, agora) !== 'proximas') return false;
        return vaga.inicio - agora >= HORAS_CANCELAMENTO * 60 * 60 * 1000;
    }

    /** Opções de término: [{ minutos, hora: "HH:MM" }] a partir do início. */
    function opcoesTermino(inicio) {
        const lista = [];
        for (let m = TERMINO_PASSO; m <= TERMINO_MAXIMO; m += TERMINO_PASSO) {
            lista.push({ minutos: m, hora: hora(new Date(inicio.getTime() + m * 60000)) });
        }
        return lista;
    }

    /** Histórico agrupado por mês: [{ rotulo: "Outubro de 2026", vagas }] na ordem recebida. */
    function agruparPorMes(vagas) {
        const grupos = [];
        vagas.forEach((v) => {
            const rotulo = MESES[v.inicio.getMonth()] + ' de ' + v.inicio.getFullYear();
            let g = grupos.find((x) => x.rotulo === rotulo);
            if (!g) {
                g = { rotulo, vagas: [] };
                grupos.push(g);
            }
            g.vagas.push(v);
        });
        return grupos;
    }

    /** Inscrição de GET /monitorias/monitor/agendamentos no formato da tela. */
    function normalizarInscricao(a) {
        return {
            id: a.id,
            idVaga: a.id_monitoria,
            aluno: (a.aluno && a.aluno.nome_completo) || 'Aluno',
            status: String(a.status || '').toLowerCase()
        };
    }

    /** Map idVaga -> inscrições em ordem alfabética, sem as canceladas. */
    function agruparInscricoes(lista) {
        const mapa = new Map();
        lista.forEach((i) => {
            if (i.status === 'cancelado') return;
            if (!mapa.has(i.idVaga)) mapa.set(i.idVaga, []);
            mapa.get(i.idVaga).push(i);
        });
        mapa.forEach((l) => l.sort((a, b) => a.aluno.localeCompare(b.aluno, 'pt-BR')));
        return mapa;
    }

    function limiteConfirmacao(vaga) {
        return new Date(vaga.inicio.getTime() + DIAS_CONFIRMACAO * MS_DIA);
    }

    /** 'confirmada' | 'cancelada' | 'antes' (sessão não começou) | 'confirmar' | 'expirada' */
    function situacaoPresenca(inscricao, vaga, agora) {
        if (inscricao.status === 'concluido') return 'confirmada';
        if (inscricao.status === 'cancelado' || vaga.status === 'cancelada') return 'cancelada';
        if (agora < vaga.inicio) return 'antes';
        if (agora > limiteConfirmacao(vaga)) return 'expirada';
        return 'confirmar';
    }

    /** Quantas presenças desta vaga ainda podem ser confirmadas agora. */
    function presencasAConfirmar(inscricoes, vaga, agora) {
        return (inscricoes || []).filter((i) => situacaoPresenca(i, vaga, agora) === 'confirmar')
            .length;
    }

    function plural(n, um, varios) {
        return n + ' ' + (n === 1 ? um : varios);
    }

    const api = {
        MESES,
        MESES_CURTOS,
        DIAS_SEMANA,
        HORAS_CANCELAMENTO,
        DIAS_CONFIRMACAO,
        PONTOS_MONITOR,
        PONTOS_ALUNO,
        hora,
        diaMes,
        diaCurto,
        duracao,
        iniciais,
        normalizar,
        grupo,
        separar,
        realizada,
        minutosComprovados,
        horasPorDisciplina,
        podeCancelar,
        opcoesTermino,
        agruparPorMes,
        normalizarInscricao,
        agruparInscricoes,
        limiteConfirmacao,
        situacaoPresenca,
        presencasAConfirmar,
        plural
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.PerfilDados = api;
})(typeof window !== 'undefined' ? window : this);
