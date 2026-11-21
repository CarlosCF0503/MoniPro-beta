// JS/painel.js
// Plano 7 (RF-012): painel da coordenação. As rotas /admin/* exigem tipo_usuario = coordenador
// (middleware isCoordenador; aluno e monitor recebem 403) e toda ação de escrita entra na auditoria.
// Os gráficos são SVG/HTML montados aqui: a CSP do site só aceita scripts do próprio domínio.
// Depende de: api.js (chamadaApi, escaparHtml, obterSessao), toast.js (showToast).
document.addEventListener('DOMContentLoaded', async () => {
    const esc = escaparHtml;
    const raiz = document.getElementById('painel-app');
    let usuario = null;
    try {
        usuario = await obterSessao();
    } catch {
        raiz.setAttribute('aria-busy', 'false');
        raiz.innerHTML =
            '<p class="pp-carregando">Não foi possível conectar ao servidor. Recarregue a página.</p>';
        return;
    }
    if (!usuario || usuario.tipo !== 'coordenador') {
        window.location.href = usuario ? 'base.html' : 'index.html?perfil=coordenacao';
        return;
    }

    const S = { periodo: null, aba: 'monitores', resumo: null, monitores: [], auditoria: [] };

    // ---------- formatação ----------
    const horas = (min) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return m ? h + 'h' + String(m).padStart(2, '0') : h + 'h';
    };
    const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
    const milhar = (n) => n.toLocaleString('pt-BR');
    const FUSO = { timeZone: 'America/Sao_Paulo' };
    const dataCurta = (iso) =>
        new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', ...FUSO });
    const dataHora = (iso) =>
        new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            ...FUSO
        });
    const ico = (d, t = 20) =>
        '<svg class="ico" width="' +
        t +
        '" height="' +
        t +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        d +
        '</svg>';
    const ICO = {
        alerta: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
        bloqueio:
            '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        pena: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        juntar: '<path d="M8 3v5a4 4 0 0 0 4 4h0a4 4 0 0 1 4 4v5"/><path d="M16 3v5a4 4 0 0 1-4 4"/>',
        ok: '<path d="M20 6 9 17l-5-5"/>',
        pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>'
    };
    const presencaBaixa = (m) => m.presenca != null && m.presenca < 0.6;

    // ---------- dados ----------
    async function carregar() {
        raiz.setAttribute('aria-busy', 'true');
        const q = S.periodo ? '?periodo=' + encodeURIComponent(S.periodo) : '';
        let r, m, a;
        try {
            [r, m, a] = await Promise.all([
                chamadaApi('/admin/resumo' + q),
                chamadaApi('/admin/monitores' + q),
                chamadaApi('/admin/auditoria?limit=20')
            ]);
        } catch {
            r = { success: false, erro: 'Não foi possível conectar ao servidor.' };
        }
        if (!r.success) {
            raiz.setAttribute('aria-busy', 'false');
            raiz.innerHTML =
                '<p class="pp-carregando">' +
                esc(r.erro || 'Não foi possível carregar o painel.') +
                '</p>';
            return;
        }
        S.resumo = r;
        S.periodo = r.periodo;
        S.monitores = (m && m.monitores) || [];
        S.auditoria = (a && a.registros) || [];
        render();
    }

    // ---------- blocos ----------
    function pendencias() {
        const baixa = S.monitores.filter(presencaBaixa).length;
        const bloq = S.resumo.inscricoes.bloqueados;
        const itens = [
            [
                'monitores',
                ICO.alerta,
                'Presença abaixo de 60%',
                baixa ? 'monitores com muitas faltas nas vagas' : 'nenhum monitor neste semestre',
                baixa
            ],
            [
                null,
                ICO.bloqueio,
                'Alunos bloqueados por faltas',
                bloq ? 'agora, pela regra de 3 faltas em 30 dias' : 'nenhum aluno bloqueado agora',
                bloq
            ]
        ];
        return (
            '<section class="pn-pend pn-pend-2" aria-label="Precisa da coordenação">' +
            itens
                .map(([aba, i, t, s, n]) => {
                    const conteudo =
                        '<span class="pn-pend-ico">' +
                        ico(i) +
                        '</span><span class="pn-pend-txt"><b>' +
                        t +
                        '</b><small>' +
                        s +
                        '</small></span><span class="pn-pend-n">' +
                        n +
                        '</span>';
                    return aba
                        ? '<button type="button" class="pn-pend-item' +
                              (n ? ' atencao' : '') +
                              '" data-pn-ir="' +
                              aba +
                              '">' +
                              conteudo +
                              '</button>'
                        : '<div class="pn-pend-item' +
                              (n ? ' atencao' : '') +
                              '">' +
                              conteudo +
                              '</div>';
                })
                .join('') +
            '</section>'
        );
    }

    function delta(atual, anterior, rotulo) {
        if (anterior == null || atual == null) return '';
        const d = anterior ? (atual - anterior) / anterior : 0;
        const cls = Math.abs(d) < 0.01 ? 'igual' : d > 0 ? 'sobe' : 'desce';
        const seta = cls === 'igual' ? '=' : d > 0 ? '▲' : '▼';
        return (
            '<span class="pn-delta ' +
            cls +
            '" title="Comparado com o mesmo ponto de ' +
            esc(rotulo) +
            '">' +
            seta +
            ' ' +
            Math.abs(Math.round(d * 100)) +
            '% vs ' +
            esc(rotulo) +
            '</span>'
        );
    }

    function kpis() {
        const r = S.resumo;
        const a = r.anterior || {};
        const ant = r.periodo_anterior;
        const k = [
            [
                'Monitorias realizadas',
                milhar(r.sessoes),
                'com presença confirmada pelos dois lados',
                delta(r.sessoes, a.sessoes, ant)
            ],
            [
                'Horas comprovadas',
                milhar(Math.floor(r.minutos / 60)) + '<small>h</small>',
                'soma das sessões finalizadas',
                delta(r.minutos, a.minutos, ant)
            ],
            [
                'Alunos atendidos',
                milhar(r.alunos),
                'pessoas diferentes no semestre',
                delta(r.alunos, a.alunos, ant)
            ],
            [
                'Presença',
                pct(r.taxa_presenca),
                milhar(r.faltas) +
                    (r.faltas === 1 ? ' falta registrada' : ' faltas registradas') +
                    ' pelos monitores',
                delta(r.taxa_presenca, a.taxa_presenca, ant)
            ]
        ];
        return (
            '<section class="pn-kpis" aria-label="Indicadores do semestre">' +
            k
                .map(
                    ([l, n, s, d]) =>
                        '<div class="pp-cartao pn-kpi"><span class="l">' +
                        l +
                        '</span><span class="n">' +
                        n +
                        '</span>' +
                        d +
                        '<span class="s">' +
                        s +
                        '</span></div>'
                )
                .join('') +
            '</section>'
        );
    }

    const semDados = (titulo, id, texto) =>
        '<section class="pp-cartao pn-graf" aria-labelledby="' +
        id +
        '"><div class="pn-graf-topo"><h2 id="' +
        id +
        '">' +
        titulo +
        '</h2></div><p class="pn-vazio">' +
        texto +
        '</p></section>';

    // Barras por semana, com a média das semanas completas em linha tracejada
    function graficoSemanas() {
        const sem = S.resumo.por_semana;
        if (!sem.length || !sem.some((s) => s.sessoes))
            return semDados(
                'Monitorias por semana',
                'g-sem',
                'Nenhuma monitoria realizada neste semestre ainda.'
            );
        // No celular o desenho é mais estreito para o texto do eixo não ficar miúdo
        const cel = window.innerWidth < 700;
        const W = cel ? 360 : 640,
            H = cel ? 220 : 230,
            E = 26,
            B = 30,
            T = 22,
            Dt = 6;
        const max = Math.max(5, Math.ceil(Math.max(...sem.map((s) => s.sessoes)) / 5) * 5);
        const y = (v) => T + (H - T - B) * (1 - v / max);
        const passo = (W - E - Dt) / sem.length;
        const larg = Math.max(3, passo * 0.64);
        // A média começa na primeira semana com monitoria: as férias do início não puxam para baixo
        const primeira = sem.findIndex((s) => s.sessoes > 0);
        const completas = sem.slice(primeira).filter((s) => !s.parcial);
        const media = completas.reduce((t, s) => t + s.sessoes, 0) / (completas.length || 1);
        const mediaTxt = media.toFixed(1).replace('.', ',');
        let g = '';
        for (let v = 0; v <= max; v += max / 5)
            g +=
                '<line class="grade" x1="' +
                E +
                '" x2="' +
                (W - Dt) +
                '" y1="' +
                y(v) +
                '" y2="' +
                y(v) +
                '"/><text class="eixo" x="' +
                (E - 6) +
                '" y="' +
                (y(v) + 4) +
                '" text-anchor="end">' +
                v +
                '</text>';
        let mesAnterior = '';
        sem.forEach((s, i) => {
            const x = E + i * passo + (passo - larg) / 2;
            const topo = y(s.sessoes);
            g +=
                '<rect class="barra' +
                (s.parcial ? ' parcial' : '') +
                '" x="' +
                x.toFixed(1) +
                '" y="' +
                topo.toFixed(1) +
                '" width="' +
                larg.toFixed(1) +
                '" height="' +
                (y(0) - topo).toFixed(1) +
                '" rx="2"><title>Semana de ' +
                dataCurta(s.inicio) +
                ': ' +
                s.sessoes +
                (s.sessoes === 1 ? ' monitoria' : ' monitorias') +
                (s.parcial ? ' (semana em andamento)' : '') +
                '</title></rect>';
            const mes = new Date(s.inicio)
                .toLocaleDateString('pt-BR', { month: 'short', ...FUSO })
                .replace('.', '');
            if (mes !== mesAnterior) {
                g +=
                    '<text class="eixo" x="' +
                    (x + larg / 2).toFixed(1) +
                    '" y="' +
                    (H - 10) +
                    '" text-anchor="middle">' +
                    mes +
                    '</text>';
                mesAnterior = mes;
            }
        });
        if (completas.length) {
            g +=
                '<line class="media" x1="' +
                E +
                '" x2="' +
                (W - Dt) +
                '" y1="' +
                y(media) +
                '" y2="' +
                y(media) +
                '"/>';
            g +=
                '<text class="media-txt" x="' +
                (E + 4) +
                '" y="' +
                (T - 8) +
                '" text-anchor="start">média de ' +
                mediaTxt +
                ' por semana</text>';
        }
        return (
            '<section class="pp-cartao pn-graf" aria-labelledby="g-sem">' +
            '<div class="pn-graf-topo"><h2 id="g-sem">Monitorias por semana</h2><span class="pn-graf-sub">' +
            sem.length +
            (sem.length === 1 ? ' semana' : ' semanas') +
            ' desde ' +
            dataCurta(sem[0].inicio) +
            '</span></div>' +
            '<svg class="pn-svg" viewBox="0 0 ' +
            W +
            ' ' +
            H +
            '" role="img" aria-label="Monitorias realizadas por semana. Média de ' +
            mediaTxt +
            ' por semana.">' +
            g +
            '</svg>' +
            '<ul class="pn-legenda"><li><i style="background:var(--navy-2)"></i>Monitorias realizadas</li>' +
            (sem[sem.length - 1].parcial
                ? '<li><i style="background:var(--soft-2);border:1px dashed var(--navy-2)"></i>Semana em andamento</li>'
                : '') +
            '<li><i class="linha"></i>Média das semanas completas</li></ul>' +
            '</section>'
        );
    }

    function graficoDisciplinas() {
        const d = S.resumo.por_disciplina;
        if (!d.length)
            return semDados(
                'Horas por disciplina',
                'g-disc',
                'Nenhuma hora comprovada neste semestre ainda.'
            );
        const max = Math.max(...d.map((x) => x.minutos));
        return (
            '<section class="pp-cartao pn-graf" aria-labelledby="g-disc">' +
            '<div class="pn-graf-topo"><h2 id="g-disc">Horas por disciplina</h2><span class="pn-graf-sub">' +
            d.length +
            (d.length === 1 ? ' disciplina' : ' disciplinas') +
            ' com monitoria</span></div>' +
            '<ul class="pn-hbar">' +
            d
                .map(
                    (x) =>
                        '<li><span class="nome" title="' +
                        esc(x.nome) +
                        '">' +
                        esc(x.nome) +
                        '</span><span class="trilho"><i style="width:' +
                        ((x.minutos / max) * 100).toFixed(1) +
                        '%"></i></span><span class="v">' +
                        horas(x.minutos) +
                        '</span></li>'
                )
                .join('') +
            '</ul></section>'
        );
    }

    function graficoInscricoes() {
        const i = S.resumo.inscricoes;
        const partes = [
            ['c-pres', i.presentes, 'Presença confirmada'],
            ['c-falta', i.faltas, 'Falta registrada'],
            ['c-cal', i.sem_confirmacao, 'Sem presença confirmada'],
            ['c-cmon', i.canceladas_monitor, 'Vaga cancelada pelo monitor']
        ];
        const tot = partes.reduce((t, p) => t + p[1], 0);
        if (!tot)
            return semDados(
                'O que aconteceu com as inscrições',
                'g-insc',
                'Nenhuma inscrição em vaga já passada neste semestre.'
            );
        return (
            '<section class="pp-cartao pn-graf" aria-labelledby="g-insc">' +
            '<div class="pn-graf-topo"><h2 id="g-insc">O que aconteceu com as inscrições</h2><span class="pn-graf-sub">' +
            milhar(tot) +
            (tot === 1 ? ' inscrição' : ' inscrições') +
            ' em vagas já passadas</span></div>' +
            '<div class="pn-pilha" role="img" aria-label="' +
            partes.map(([, n, t]) => t + ': ' + n).join(', ') +
            '">' +
            partes
                .filter((p) => p[1])
                .map(
                    ([c, n, t]) =>
                        '<i class="' +
                        c +
                        '" style="width:' +
                        ((n / tot) * 100).toFixed(2) +
                        '%" title="' +
                        t +
                        ': ' +
                        n +
                        '"></i>'
                )
                .join('') +
            '</div><ul class="pn-insc">' +
            partes
                .map(
                    ([c, n, t]) =>
                        '<li><i class="' +
                        c +
                        '"></i><b>' +
                        milhar(n) +
                        '<small>' +
                        pct(n / tot) +
                        '</small></b><span>' +
                        t +
                        '</span></li>'
                )
                .join('') +
            '</ul><p class="pn-graf-sub">"Sem presença confirmada" inclui vagas que o monitor ainda não finalizou. Inscrições canceladas pelo aluno não ficam registradas.</p></section>'
        );
    }

    // Procura por dia e turno (manhã antes das 12h, tarde 12h–18h, noite depois das 18h)
    function graficoHorarios() {
        const m = S.resumo.procura;
        const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const per = [
            ['manha', 'Manhã'],
            ['tarde', 'Tarde'],
            ['noite', 'Noite']
        ];
        const max = Math.max(...per.flatMap(([k]) => m[k]));
        if (!max)
            return semDados(
                'Quando os alunos procuram',
                'g-hor',
                'Nenhuma inscrição neste semestre ainda.'
            );
        let g = '<span></span>' + dias.map((d) => '<span class="cab">' + d + '</span>').join('');
        per.forEach(([k, nome]) => {
            g += '<span class="lin">' + nome + '</span>';
            m[k].forEach((v, i) => {
                const a = 0.08 + 0.92 * (v / max);
                g +=
                    '<span class="cel' +
                    (v / max > 0.55 ? ' escura' : '') +
                    '" style="background: rgba(31, 66, 135, ' +
                    a.toFixed(2) +
                    ')" title="' +
                    dias[i] +
                    ', ' +
                    nome.toLowerCase() +
                    ': ' +
                    v +
                    (v === 1 ? ' inscrição' : ' inscrições') +
                    '">' +
                    v +
                    '</span>';
            });
        });
        return (
            '<section class="pp-cartao pn-graf" aria-labelledby="g-hor">' +
            '<div class="pn-graf-topo"><h2 id="g-hor">Quando os alunos procuram</h2><span class="pn-graf-sub">inscrições por dia e turno da vaga</span></div>' +
            '<div class="pn-mapa-wrap"><div class="pn-mapa" role="img" aria-label="Inscrições por dia da semana e turno">' +
            g +
            '</div></div>' +
            '<div class="pn-mapa-esc"><span>menos</span><i style="background:rgba(31,66,135,.1)"></i><i style="background:rgba(31,66,135,.4)"></i><i style="background:rgba(31,66,135,.7)"></i><i style="background:rgba(31,66,135,1)"></i><span>mais</span></div>' +
            '</section>'
        );
    }

    function tabela(cab, linhas, vazio) {
        if (!linhas.length) return '<p class="pn-vazio">' + vazio + '</p>';
        return (
            '<div class="pn-tabela-wrap"><table><thead><tr>' +
            cab
                .map(
                    ([t, c]) =>
                        '<th' + (c ? ' class="' + c + '"' : '') + ' scope="col">' + t + '</th>'
                )
                .join('') +
            '</tr></thead><tbody>' +
            linhas.join('') +
            '</tbody></table></div>'
        );
    }

    function spark(valores) {
        const W = 96,
            H = 28,
            P = 3;
        const max = Math.max(1, ...valores);
        const pts = valores.map((v, i) => [
            P + (i * (W - 2 * P)) / (valores.length - 1),
            H - P - (v / max) * (H - 2 * P)
        ]);
        const l = pts
            .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
            .join(' ');
        const a =
            l +
            ' L' +
            pts[pts.length - 1][0].toFixed(1) +
            ' ' +
            (H - P) +
            ' L' +
            P +
            ' ' +
            (H - P) +
            ' Z';
        const u = pts[pts.length - 1];
        return (
            '<svg class="pn-spark" viewBox="0 0 ' +
            W +
            ' ' +
            H +
            '" role="img" aria-label="Monitorias nas últimas 8 semanas: ' +
            valores.join(', ') +
            '"><path class="a" d="' +
            a +
            '"/><path class="l" d="' +
            l +
            '"/><circle cx="' +
            u[0].toFixed(1) +
            '" cy="' +
            u[1].toFixed(1) +
            '" r="2.6"/></svg>'
        );
    }

    function abaMonitores() {
        const situ = { emitido: ['pill-ok', 'Emitido'], nenhum: ['pill-aberta', 'Não emitido'] };
        return tabela(
            [
                ['Monitor'],
                ['Disciplinas'],
                ['Sessões', 'num'],
                ['Horas', 'num'],
                ['Alunos', 'num'],
                ['Presença', 'num'],
                ['Últimas 8 semanas', 'num'],
                ['Certificado']
            ],
            S.monitores.map((m) => {
                const s = situ[m.certificado] || situ.nenhum;
                const p =
                    m.presenca == null
                        ? '<small>sem dados</small>'
                        : '<span class="pn-pres' +
                          (presencaBaixa(m) ? ' baixa' : '') +
                          '"><span class="trilho"><i style="width:' +
                          pct(m.presenca) +
                          '"></i></span>' +
                          pct(m.presenca) +
                          '</span>';
                return (
                    '<tr><td><b>' +
                    esc(m.nome) +
                    '</b><small>' +
                    esc(m.email) +
                    '</small></td><td>' +
                    esc(m.disciplinas.join(', ') || '—') +
                    '</td><td class="num">' +
                    m.sessoes +
                    '</td><td class="num">' +
                    horas(m.minutos) +
                    '</td><td class="num">' +
                    m.alunos +
                    '</td>' +
                    '<td class="num">' +
                    p +
                    '</td><td class="num">' +
                    spark(m.semanas) +
                    '</td><td><span class="pill ' +
                    s[0] +
                    '">' +
                    s[1] +
                    '</span></td></tr>'
                );
            }),
            'Nenhum monitor com vaga neste semestre.'
        );
    }

    function abaAtividade() {
        const tipo = {
            criar_coordenador: [ICO.pessoa, ''],
            assinar_certificado: [ICO.pena, 'ok'],
            revogar_certificado: [ICO.x, 'perigo'],
            aprovar_disciplina: [ICO.ok, 'ok'],
            mesclar_disciplina: [ICO.juntar, '']
        };
        if (!S.auditoria.length) return '<p class="pn-vazio">Nenhuma ação registrada ainda.</p>';
        return (
            '<p class="pn-dica">Toda ação do painel fica registrada com quem fez e quando. O registro não pode ser apagado pelo painel.</p>' +
            '<ul class="pn-log">' +
            S.auditoria
                .map((r) => {
                    const [i, c] = tipo[r.acao] || [ICO.ok, ''];
                    return (
                        '<li><span class="ic ' +
                        c +
                        '">' +
                        ico(i, 18) +
                        '</span><div><p>' +
                        esc(r.descricao) +
                        '</p><small>' +
                        esc(r.usuario) +
                        '</small></div><time datetime="' +
                        esc(r.criado_em) +
                        '">' +
                        dataHora(r.criado_em) +
                        '</time></li>'
                    );
                })
                .join('') +
            '</ul>'
        );
    }

    function gestao() {
        const baixa = S.monitores.filter(presencaBaixa).length;
        const abas = [
            ['monitores', 'Monitores', S.monitores.length, baixa > 0],
            ['atividade', 'Atividade', null, false]
        ];
        const corpo = S.aba === 'atividade' ? abaAtividade() : abaMonitores();
        return (
            '<section class="pp-cartao pn-gestao" id="pn-gestao" aria-label="Gestão">' +
            '<div class="pp-abas" role="tablist">' +
            abas
                .map(
                    ([k, t, n, at]) =>
                        '<button type="button" class="pp-aba" role="tab" id="aba-' +
                        k +
                        '" aria-controls="pn-painel" data-pn-aba="' +
                        k +
                        '" aria-selected="' +
                        (S.aba === k) +
                        '">' +
                        t +
                        (n == null
                            ? ''
                            : '<span class="cnt' + (at ? ' atencao' : '') + '">' + n + '</span>') +
                        '</button>'
                )
                .join('') +
            '</div><div role="tabpanel" id="pn-painel" aria-labelledby="aba-' +
            S.aba +
            '">' +
            corpo +
            '</div></section>'
        );
    }

    function render() {
        raiz.setAttribute('aria-busy', 'false');
        const r = S.resumo;
        raiz.innerHTML =
            '<div class="pp-desk pn-desk">' +
            '<div class="pp-cabecalho"><div><h1>Painel da coordenação <span class="chip chip-papel">Coordenação</span></h1>' +
            '<p>' +
            esc(usuario.nome) +
            ' · ' +
            esc(r.rotulo_periodo) +
            ' · dados até ' +
            dataHora(r.atualizado_em) +
            '</p></div>' +
            '<label class="pn-sem" for="pn-sem">Semestre <select id="pn-sem">' +
            r.periodos
                .map(
                    (p) =>
                        '<option' +
                        (p === S.periodo ? ' selected' : '') +
                        '>' +
                        esc(p) +
                        '</option>'
                )
                .join('') +
            '</select></label></div>' +
            pendencias() +
            kpis() +
            '<div class="pn-graficos">' +
            graficoSemanas() +
            graficoDisciplinas() +
            graficoInscricoes() +
            graficoHorarios() +
            '</div>' +
            gestao() +
            '</div>';
    }

    // ---------- eventos ----------
    raiz.addEventListener('change', (ev) => {
        if (ev.target.id === 'pn-sem') {
            S.periodo = ev.target.value;
            carregar();
        }
    });

    raiz.addEventListener('click', (ev) => {
        const ir = ev.target.closest('[data-pn-ir]');
        if (ir) {
            S.aba = ir.dataset.pnIr;
            render();
            document
                .getElementById('pn-gestao')
                .scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        const aba = ev.target.closest('[data-pn-aba]');
        if (aba) {
            S.aba = aba.dataset.pnAba;
            render();
            document.getElementById('aba-' + S.aba).focus();
        }
    });

    carregar();
});
