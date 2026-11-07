// JS/marcar/componentes.js
// Pedaços de HTML da tela de marcar monitoria (calendário, card de vaga, passos etc.).
// Todo texto vindo da API passa por escaparHtml (api.js) antes de entrar no HTML.
// Depende de: api.js (escaparHtml), marcar/datas.js (MarcarDatas).

(function () {
    const D = window.MarcarDatas;
    const esc = escaparHtml;

    // Ícones de traço no mesmo estilo dos SVGs do header (stroke arredondado, currentColor)
    const ICONES = {
        relogio: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
        local: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
        pessoas:
            '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
        inscrito:
            '<circle cx="9" cy="8" r="4"/><path d="M2 20c0-4 3.1-7 7-7s7 3 7 7"/><polyline points="16 11 18 13 22 9"/>',
        livro: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
        calendario:
            '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        agendar:
            '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>',
        criar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/>',
        assunto: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        alerta: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        lotada: '<circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
        ok: '<polyline points="20 6 9 17 4 12"/>',
        olho: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        esquerda: '<polyline points="15 18 9 12 15 6"/>',
        direita: '<polyline points="9 18 15 12 9 6"/>',
        abaixo: '<polyline points="6 9 12 15 18 9"/>'
    };

    function icone(nome, tamanho, traco) {
        const t = tamanho || 14;
        return (
            '<svg class="ico" width="' +
            t +
            '" height="' +
            t +
            '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
            (traco || 2) +
            '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            ICONES[nome] +
            '</svg>'
        );
    }

    /**
     * Calendário do mês. Só um dia fica na ordem do Tab (tabindex=0); as setas movem entre os
     * dias (tratado em tela.js).
     * @param {object} o - { ano, mes, agora, selecionado, contagem, aceitaDiaVazio, rotuloQtd,
     *                       legenda, resumo }
     */
    function calendario(o) {
        const primeiro = new Date(o.ano, o.mes, 1).getDay();
        const ultimo = new Date(o.ano, o.mes + 1, 0).getDate();
        const hoje = D.chave(o.agora);
        const dias = [];
        for (let d = 1; d <= ultimo; d++) {
            const data = new Date(o.ano, o.mes, d);
            const k = D.chave(data);
            const n = o.contagem[k] || 0;
            const passado = D.diaPassado(data, o.agora);
            dias.push({
                d,
                k,
                n,
                ativo: n > 0 && !passado,
                fds: data.getDay() === 0 || data.getDay() === 6,
                bloqueado: passado || (!o.aceitaDiaVazio && n === 0)
            });
        }
        const foco = (
            dias.find((x) => x.k === o.selecionado && !x.bloqueado) ||
            dias.find((x) => !x.bloqueado) ||
            {}
        ).k;
        let grade = D.DIAS_SEMANA.map(
            (n) => '<span class="dw" aria-hidden="true">' + n + '</span>'
        ).join('');
        for (let i = 0; i < primeiro; i++) grade += '<span></span>';
        dias.forEach((x) => {
            const classes = ['dia'];
            if (x.ativo) classes.push('tem');
            if (x.k === hoje) classes.push('hoje');
            if (x.fds) classes.push('fds');
            const pontos = x.ativo ? '<i></i>'.repeat(Math.min(x.n, 3)) : '';
            grade +=
                '<button type="button" class="' +
                classes.join(' ') +
                '" data-acao="dia" data-dia="' +
                x.k +
                '" tabindex="' +
                (x.k === foco ? 0 : -1) +
                '" aria-pressed="' +
                (x.k === o.selecionado) +
                '"' +
                (x.bloqueado ? ' disabled' : '') +
                ' aria-label="' +
                x.d +
                ' de ' +
                D.MESES[o.mes] +
                ', ' +
                o.rotuloQtd(x.n) +
                (x.k === hoje ? ', hoje' : '') +
                '"><span>' +
                x.d +
                '</span><span class="pontos">' +
                pontos +
                '</span></button>';
        });
        const nomeMes = D.MESES[o.mes][0].toUpperCase() + D.MESES[o.mes].slice(1);
        return (
            '<div class="cal">' +
            '<div class="cal-topo"><button type="button" class="nav" data-acao="mes" data-delta="-1" aria-label="Mês anterior">' +
            icone('esquerda', 18, 2.5) +
            '</button><h3 aria-live="polite">' +
            nomeMes +
            ' <span>' +
            o.ano +
            '</span></h3><button type="button" class="nav" data-acao="mes" data-delta="1" aria-label="Próximo mês">' +
            icone('direita', 18, 2.5) +
            '</button></div>' +
            '<div class="cal-grade" role="group" aria-label="Dias do mês. Use as setas para mudar de dia.">' +
            grade +
            '</div>' +
            '<div class="cal-rodape"><span>' +
            o.resumo +
            '</span><span class="legenda"><span><i class="amostra amostra-tem"></i>' +
            o.legenda +
            '</span><span><i class="amostra amostra-hoje"></i>Hoje</span></span></div></div>'
        );
    }

    function chipVaga(v) {
        if (v.situacao === 'inscrito')
            return (
                '<span class="chip info">' + icone('inscrito', 12) + 'Você já está inscrito</span>'
            );
        if (v.situacao === 'cancelado')
            return (
                '<span class="chip neutro">' + icone('inscrito', 12) + 'Inscrição cancelada</span>'
            );
        if (v.livres <= 0) return '<span class="chip bad">' + icone('lotada', 12) + 'Lotada</span>';
        if (v.livres === 1)
            return '<span class="chip warn">' + icone('alerta', 12) + 'Último lugar</span>';
        return (
            '<span class="chip ok">' +
            icone('pessoas', 12) +
            v.livres +
            ' de ' +
            v.capacidade +
            ' livres</span>'
        );
    }

    /** Card de vaga. Estático na prévia do monitor; botão selecionável na lista do aluno. */
    function cardVaga(v, opcoes) {
        const o = opcoes || {};
        const bloqueada = Boolean(v.situacao) || v.livres <= 0;
        const tag = o.estatico ? 'div' : 'button';
        const attrs = o.estatico
            ? ''
            : ' type="button" data-acao="vaga" data-id="' +
              v.id +
              '" aria-pressed="' +
              Boolean(o.selecionada) +
              '"' +
              (bloqueada ? ' disabled' : '');
        return (
            '<' +
            tag +
            ' class="vaga"' +
            attrs +
            '><span class="av" aria-hidden="true">' +
            esc(D.iniciais(v.monitor)) +
            '</span><span class="vaga-info"><b>' +
            esc(v.monitor) +
            '</b><span class="meta"><span class="h">' +
            icone('relogio', 13) +
            D.hora(v.inicio) +
            '</span><span>' +
            icone('local', 13) +
            esc(v.local || 'A definir') +
            '</span></span>' +
            (v.descricao
                ? '<span class="assunto">' + icone('assunto', 12) + esc(v.descricao) + '</span>'
                : '') +
            '</span>' +
            chipVaga(v) +
            '</' +
            tag +
            '>'
        );
    }

    function diaSelecionado(k, acao) {
        return (
            '<div class="dia-sel">' +
            icone('calendario', 16) +
            '<b>' +
            esc(D.diaLongo(D.deChave(k))) +
            '</b><button type="button" class="link" data-acao="' +
            acao +
            '" data-passo="1">Trocar dia</button></div>'
        );
    }

    function passos(nomes, atual) {
        return (
            '<ol class="passos" aria-label="Etapas">' +
            nomes
                .map((nome, i) => {
                    let classe = '';
                    if (i + 1 === atual) classe = 'on';
                    else if (i + 1 < atual) classe = 'feito';
                    return (
                        '<li class="' +
                        classe +
                        '"' +
                        (i + 1 === atual ? ' aria-current="step"' : '') +
                        '>' +
                        (i + 1) +
                        '. ' +
                        nome +
                        '</li>'
                    );
                })
                .join('') +
            '</ol>'
        );
    }

    function carregando(texto) {
        return (
            '<div class="esqueleto" aria-busy="true"><span class="sr-only">' +
            esc(texto) +
            '</span><i></i><i></i><i></i></div>'
        );
    }

    function linhaResumo(rotulo, nomeIcone, valor) {
        return '<dt>' + icone(nomeIcone) + rotulo + '</dt><dd>' + esc(valor) + '</dd>';
    }

    /**
     * Caixa do horário: um botão que abre uma lista curta com rolagem própria (padrão
     * combobox/listbox do WAI-ARIA). Substitui o <input type="time">, que só abria pelo ícone
     * do relógio, e o <select>, cuja lista nativa o navegador estica até o fim da página.
     * @param {string} atual - horário escolhido ("HH:MM") ou ''.
     * @param {string[]} ocupados - horários em que o monitor já tem vaga no dia.
     * @param {string} atributos - aria-describedby/aria-invalid já montados.
     */
    function campoHora(atual, ocupados, atributos) {
        const itens = D.horarios(atual)
            .map(
                (h) =>
                    '<li role="option" id="h-' +
                    h.replace(':', '') +
                    '" data-hora="' +
                    h +
                    '" aria-selected="' +
                    (h === atual) +
                    '">' +
                    h +
                    (ocupados.includes(h) ? '<span class="tag-ocupado">já tem vaga</span>' : '') +
                    '</li>'
            )
            .join('');
        return (
            '<div class="hora"><button type="button" id="f-hora" class="hora-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="lista-hora"' +
            atributos +
            '>' +
            icone('relogio', 16) +
            '<span class="valor' +
            (atual ? '' : ' sem-valor') +
            '">' +
            esc(atual || 'Escolher') +
            '</span><span class="seta">' +
            icone('abaixo', 16, 2.5) +
            '</span></button><ul class="hora-lista" id="lista-hora" role="listbox" aria-label="Horários" tabindex="-1" hidden>' +
            itens +
            '</ul></div>'
        );
    }

    window.MarcarComponentes = {
        icone,
        calendario,
        cardVaga,
        diaSelecionado,
        passos,
        carregando,
        linhaResumo,
        campoHora
    };
})();
