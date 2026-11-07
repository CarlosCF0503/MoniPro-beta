// JS/marcar/datas.js
// Funções puras da tela de marcar monitoria: datas, agrupamento de vagas e validação do
// formulário do monitor. Não tocam no DOM, então rodam no navegador (global MarcarDatas)
// e no Jest (module.exports) — ver tests/marcarDatas.test.js.
/* global module */

(function (raiz) {
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
    const LIMITE_DESCRICAO = 500;

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
            livres
        };
    }

    /** Só vagas que ainda vão acontecer, em ordem de horário. */
    function vagasFuturas(vagas, agora) {
        return vagas.filter((v) => v.inicio > agora).sort((a, b) => a.inicio - b.inicio);
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
     * Valida o formulário de nova vaga com as mesmas regras de monitoriaSchemas.js, mais o
     * conflito de horário com outra vaga do mesmo monitor no dia (só o front verifica hoje).
     * @returns {object} campo → mensagem; vazio quando está tudo certo.
     */
    function validarVaga(form, agora, minhasNoDia) {
        const erros = {};
        const data = dataDoFormulario(form.dia, form.hora);
        if (!data) erros.dia = 'Escolha o dia no calendário.';
        if (!form.hora) erros.hora = 'Informe o horário.';
        else if (data && data <= agora) erros.hora = 'O horário precisa estar no futuro.';
        else if (data && (minhasNoDia || []).some((v) => hora(v.inicio) === form.hora))
            erros.hora = 'Você já tem uma vaga às ' + form.hora + ' neste dia.';

        const local = String(form.local || '').trim();
        if (!local) erros.local = 'O local é obrigatório.';
        else if (local.length > LIMITE_LOCAL)
            erros.local = 'Máximo de ' + LIMITE_LOCAL + ' caracteres.';

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
        MESES,
        DIAS_SEMANA,
        LIMITE_DESCRICAO,
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
        vagasFuturas,
        vagasDoDia,
        contarPorDia,
        dataDoFormulario,
        validarVaga
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.MarcarDatas = api;
})(typeof window !== 'undefined' ? window : this);
