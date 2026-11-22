// JS/painel.js
// Plano 7 (RF-012): painel da coordenação. As rotas /admin/* exigem tipo_usuario = coordenador
// (middleware isCoordenador; aluno e monitor recebem 403) e toda ação de escrita entra na auditoria.
// Os gráficos são SVG/HTML montados aqui: a CSP do site só aceita scripts do próprio domínio.
// Depende de: api.js (chamadaApi, escaparHtml, obterSessao, MB_BETA_ORM), toast.js (showToast,
// mensagemDaApi).
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

    const S = {
        periodo: null,
        aba: 'certificados',
        filtroCert: 'pendente',
        resumo: null,
        monitores: [],
        certificados: { pendente: [], assinado: [] },
        disciplinas: [],
        aprovadas: [],
        faltas: { recursos: [], faltas: [], sem_presenca: [], bloqueados: [] },
        filtroFalta: 'recursos',
        auditoria: []
    };

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
        cert: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="m9 15 2 2 4-4"/>',
        livro: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
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
        const ps = q ? '&' + q.slice(1) : '';
        let r, m, a, cp, ca, di, fa;
        try {
            [r, m, a, cp, ca, di, fa] = await Promise.all([
                chamadaApi('/admin/resumo' + q),
                chamadaApi('/admin/monitores' + q),
                chamadaApi('/admin/auditoria?limit=20'),
                chamadaApi('/admin/certificados?situacao=pendente'),
                chamadaApi('/admin/certificados?situacao=assinado' + ps),
                chamadaApi('/admin/disciplinas'),
                chamadaApi('/admin/faltas' + q)
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
        S.certificados = {
            pendente: (cp && cp.certificados) || [],
            assinado: (ca && ca.certificados) || []
        };
        S.disciplinas = (di && di.disciplinas) || [];
        S.aprovadas = (di && di.aprovadas) || [];
        S.faltas = {
            recursos: (fa && fa.recursos) || [],
            faltas: (fa && fa.faltas) || [],
            sem_presenca: (fa && fa.sem_presenca) || [],
            bloqueados: (fa && fa.bloqueados) || []
        };
        render();
    }

    // ---------- blocos ----------
    function pendencias() {
        const baixa = S.monitores.filter(presencaBaixa).length;
        const bloq = S.resumo.inscricoes.bloqueados;
        const cert = S.certificados.pendente.length;
        const disc = S.disciplinas.length;
        const itens = [
            [
                'certificados',
                ICO.cert,
                'Certificados para assinar',
                cert ? 'monitores esperando a assinatura' : 'nenhum esperando assinatura',
                cert
            ],
            [
                'disciplinas',
                ICO.livro,
                'Disciplinas para revisar',
                disc
                    ? 'criadas por monitores, ainda ocultas para alunos'
                    : 'nenhuma esperando revisão',
                disc
            ],
            [
                'monitores',
                ICO.alerta,
                'Presença abaixo de 60%',
                baixa ? 'monitores com muitas faltas nas vagas' : 'nenhum monitor neste semestre',
                baixa
            ],
            [
                'faltas',
                ICO.bloqueio,
                'Recursos de falta',
                S.faltas.recursos.length
                    ? 'alunos pedindo revisão com atestado'
                    : bloq
                      ? 'nenhum pedido; ' +
                        bloq +
                        (bloq === 1 ? ' aluno bloqueado' : ' alunos bloqueados')
                      : 'nenhum pedido de revisão',
                S.faltas.recursos.length
            ]
        ];
        return (
            '<section class="pn-pend" aria-label="Precisa da coordenação">' +
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
            '<li><i class="linha"></i>Média das semanas completas desde a primeira monitoria</li></ul>' +
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
        const situ = {
            assinado: ['pill-ok', 'Assinado'],
            pendente: ['pill-atencao', 'Para assinar'],
            nenhum: ['pill-aberta', 'Não emitido']
        };
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

    const codigoLegivel = (c) => c.match(/.{1,4}/g).join('-');

    function abaCertificados() {
        const f = S.filtroCert;
        const lista = S.certificados[f];
        const filtro =
            '<div class="pn-filtro" role="group" aria-label="Situação">' +
            [
                ['pendente', 'Para assinar', S.certificados.pendente.length],
                ['assinado', 'Assinados em ' + S.periodo, S.certificados.assinado.length]
            ]
                .map(
                    ([k, t, n]) =>
                        '<button type="button" data-pn-cert="' +
                        k +
                        '" aria-pressed="' +
                        (f === k) +
                        '">' +
                        esc(t) +
                        ' (' +
                        n +
                        ')</button>'
                )
                .join('') +
            '</div>';
        const nome = (c) =>
            '<td><b>' +
            esc(c.monitor) +
            '</b><small class="pn-cod">' +
            esc(codigoLegivel(c.codigo)) +
            '</small></td>';
        if (f === 'pendente')
            return (
                filtro +
                '<p class="pn-dica">O certificado já vale como "emitido pela plataforma". Com a assinatura, o documento e a verificação pública passam a mostrar quem da coordenação assinou e quando. Confira as sessões antes de assinar.</p>' +
                tabela(
                    [
                        ['Monitor'],
                        ['Semestre'],
                        ['Carga', 'num'],
                        ['Sessões', 'num'],
                        ['Emitido em'],
                        ['', 'num']
                    ],
                    lista.map(
                        (c) =>
                            '<tr>' +
                            nome(c) +
                            '<td>' +
                            esc(c.periodo) +
                            '</td><td class="num">' +
                            horas(c.carga_minutos) +
                            '</td><td class="num">' +
                            (c.sessoes == null ? '—' : c.sessoes) +
                            '</td><td>' +
                            dataCurta(c.emitido_em) +
                            '</td><td><div class="pn-acoes"><button type="button" class="pp-btn pp-btn-sec pp-btn-p" data-pn="sessoes" data-id="' +
                            c.id +
                            '">Conferir sessões</button><button type="button" class="pp-btn pp-btn-pri pp-btn-p" data-pn="assinar" data-id="' +
                            c.id +
                            '">' +
                            ico(ICO.pena, 16) +
                            'Assinar</button></div></td></tr>'
                    ),
                    'Nenhum certificado esperando assinatura.'
                )
            );
        return (
            filtro +
            '<p class="pn-dica">Revogar invalida o código na verificação pública e avisa o monitor por e-mail com o motivo. Ele pode emitir outro certificado depois.</p>' +
            tabela(
                [['Monitor'], ['Semestre'], ['Carga', 'num'], ['Assinado em'], ['', 'num']],
                lista.map(
                    (c) =>
                        '<tr>' +
                        nome(c) +
                        '<td>' +
                        esc(c.periodo) +
                        '</td><td class="num">' +
                        horas(c.carga_minutos) +
                        '</td><td>' +
                        dataCurta(c.assinado_em) +
                        '<small>por ' +
                        esc(c.assinante) +
                        '</small></td><td><div class="pn-acoes"><button type="button" class="pp-btn pp-btn-texto-perigo pp-btn-p" data-pn="revogar" data-id="' +
                        c.id +
                        '">Revogar</button></div></td></tr>'
                ),
                'Nenhum certificado assinado em ' + esc(S.periodo) + '.'
            )
        );
    }

    function abaDisciplinas() {
        return (
            '<p class="pn-dica">Disciplinas cadastradas por monitores ficam ocultas para os alunos até a revisão. Aprovar publica a disciplina. Mesclar junta com uma que já existe: as vagas e os pontos passam para ela.</p>' +
            tabela(
                [['Nome pedido'], ['Pedido por'], ['Parecida com'], ['Vagas', 'num'], ['', 'num']],
                S.disciplinas.map(
                    (d) =>
                        '<tr><td><b>' +
                        esc(d.nome) +
                        '</b><small>em ' +
                        dataCurta(d.criada_em) +
                        '</small></td><td>' +
                        esc(d.criador || '—') +
                        '</td><td>' +
                        (d.parecida
                            ? '<span class="pill pill-atencao">' + esc(d.parecida.nome) + '</span>'
                            : '<small>nenhuma</small>') +
                        '</td><td class="num">' +
                        d.vagas +
                        '</td><td><div class="pn-acoes">' +
                        '<button type="button" class="pp-btn pp-btn-sec pp-btn-p" data-pn="mesclar" data-id="' +
                        d.id +
                        '">' +
                        ico(ICO.juntar, 16) +
                        'Mesclar</button><button type="button" class="pp-btn pp-btn-pri pp-btn-p" data-pn="aprovar" data-id="' +
                        d.id +
                        '">Aprovar</button></div></td></tr>'
                ),
                'Nenhuma disciplina esperando revisão.'
            )
        );
    }

    function abaFaltas() {
        const F = S.faltas;
        const f = S.filtroFalta;
        const bloq = F.bloqueados.length
            ? '<p class="pn-dica"><b>Bloqueados agora:</b> ' +
              F.bloqueados
                  .map((b) => esc(b.aluno || 'conta excluída') + ' (até ' + dataCurta(b.ate) + ')')
                  .join(', ') +
              '. Anular uma falta recalcula o bloqueio na hora.</p>'
            : '<p class="pn-dica">Nenhum aluno bloqueado por faltas agora.</p>';
        const filtro =
            '<div class="pn-filtro" role="group" aria-label="Lista">' +
            [
                ['recursos', 'Pedidos de revisão', F.recursos.length],
                ['faltas', 'Faltas registradas', F.faltas.length],
                ['sem', 'Sem presença confirmada', F.sem_presenca.length]
            ]
                .map(
                    ([k, t, n]) =>
                        '<button type="button" data-pn-falta="' +
                        k +
                        '" aria-pressed="' +
                        (f === k) +
                        '">' +
                        t +
                        ' (' +
                        n +
                        ')</button>'
                )
                .join('') +
            '</div>';
        const sessao = (x) =>
            '<td><b>' +
            esc(x.aluno) +
            '</b><small>' +
            esc(x.disciplina) +
            ' · ' +
            esc(x.monitor) +
            '</small></td><td>' +
            dataHora(x.horario) +
            '</td>';
        const tamanho = (b) =>
            b >= 1048576
                ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB'
                : Math.max(1, Math.round(b / 1024)) + ' KB';
        if (f === 'recursos')
            return (
                filtro +
                '<p class="pn-dica">O aluno explicou a falta e anexou um comprovante. Aceitar anula a falta (não vira presença nem dá pontos). Recusar mantém a falta, e o aluno recebe o motivo por e-mail. O comprovante é um dado de saúde: abra só para decidir, sem baixar para outro lugar.</p>' +
                tabela(
                    [['Aluno'], ['Sessão'], ['Justificativa'], ['Comprovante'], ['', 'num']],
                    F.recursos.map(
                        (x) =>
                            '<tr>' +
                            sessao(x) +
                            '<td class="pn-just">' +
                            esc(x.justificativa) +
                            '<small>enviado em ' +
                            dataCurta(x.criado_em) +
                            '</small></td><td>' +
                            '<a class="pn-anexo" href="' +
                            MB_BETA_ORM +
                            '/admin/recursos/' +
                            x.id +
                            '/arquivo" target="_blank" rel="noopener">' +
                            ico(ICO.cert, 16) +
                            esc(x.arquivo.nome) +
                            '</a><small>' +
                            esc(tamanho(x.arquivo.tamanho)) +
                            '</small></td><td><div class="pn-acoes"><button type="button" class="pp-btn pp-btn-texto-perigo pp-btn-p" data-pn="recusar-recurso" data-id="' +
                            x.id +
                            '">Recusar</button><button type="button" class="pp-btn pp-btn-pri pp-btn-p" data-pn="aceitar-recurso" data-id="' +
                            x.id +
                            '">Aceitar e anular</button></div></td></tr>'
                    ),
                    'Nenhum pedido de revisão esperando análise.'
                )
            );
        if (f === 'faltas')
            return (
                filtro +
                bloq +
                tabela(
                    [['Aluno'], ['Sessão'], ['Falta marcada em'], ['', 'num']],
                    F.faltas.map(
                        (x) =>
                            '<tr>' +
                            sessao(x) +
                            '<td>' +
                            dataHora(x.ausente_em) +
                            '</td><td><div class="pn-acoes"><button type="button" class="pp-btn pp-btn-sec pp-btn-p" data-pn="anular" data-id="' +
                            x.id +
                            '">Anular falta</button></div></td></tr>'
                    ),
                    'Nenhuma falta registrada neste semestre.'
                )
            );
        return (
            filtro +
            '<p class="pn-dica">Inscrições em sessões que já começaram, sem presença confirmada pelos dois lados e sem falta. A coordenação pode marcar a falta mesmo depois dos 7 dias do monitor.</p>' +
            tabela(
                [['Aluno'], ['Sessão'], ['Aluno confirmou?'], ['', 'num']],
                F.sem_presenca.map(
                    (x) =>
                        '<tr>' +
                        sessao(x) +
                        '<td>' +
                        (x.aluno_confirmou
                            ? '<span class="pill pill-ok">Sim</span>'
                            : '<span class="pill pill-aberta">Não</span>') +
                        '</td><td><div class="pn-acoes"><button type="button" class="pp-btn pp-btn-texto-perigo pp-btn-p" data-pn="marcar-falta" data-id="' +
                        x.id +
                        '">Marcar falta</button></div></td></tr>'
                ),
                'Nenhuma inscrição sem presença neste semestre.'
            )
        );
    }

    function abaAtividade() {
        const tipo = {
            criar_coordenador: [ICO.pessoa, ''],
            assinar_certificado: [ICO.pena, 'ok'],
            revogar_certificado: [ICO.x, 'perigo'],
            aprovar_disciplina: [ICO.ok, 'ok'],
            mesclar_disciplina: [ICO.juntar, ''],
            marcar_falta: [ICO.alerta, 'perigo'],
            anular_falta: [ICO.ok, 'ok'],
            aceitar_recurso: [ICO.ok, 'ok'],
            recusar_recurso: [ICO.x, 'perigo']
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
        const pend = S.certificados.pendente.length;
        const abas = [
            ['certificados', 'Certificados', pend, pend > 0],
            [
                'disciplinas',
                'Disciplinas pendentes',
                S.disciplinas.length,
                S.disciplinas.length > 0
            ],
            [
                'faltas',
                'Faltas',
                S.faltas.recursos.length || S.faltas.faltas.length,
                S.faltas.recursos.length > 0
            ],
            ['monitores', 'Monitores', S.monitores.length, baixa > 0],
            ['atividade', 'Atividade', null, false]
        ];
        const corpo = {
            certificados: abaCertificados,
            disciplinas: abaDisciplinas,
            faltas: abaFaltas,
            monitores: abaMonitores,
            atividade: abaAtividade
        }[S.aba]();
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

    // ---------- certificados: diálogos e ações ----------
    const dlgSes = document.getElementById('dlg-sessoes');
    const dlgRev = document.getElementById('dlg-revogar');
    document
        .querySelectorAll('.pp-dlg [data-fechar]')
        .forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
    const dataLonga = (iso) =>
        new Date(iso).toLocaleString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            ...FUSO
        });

    async function abrirSessoes(c) {
        document.getElementById('ses-titulo').textContent = c.monitor + ' · ' + c.periodo;
        const lista = document.getElementById('ses-lista');
        const total = document.getElementById('ses-total');
        lista.innerHTML = '<li><small>Carregando…</small></li>';
        total.textContent = '';
        document.getElementById('ses-assinar').dataset.id = c.id;
        dlgSes.showModal();
        let r;
        try {
            r = await chamadaApi('/admin/certificados/' + c.id + '/sessoes');
        } catch {
            r = { success: false };
        }
        if (!r.success) {
            lista.innerHTML =
                '<li><small>' +
                esc(r.erro || 'Não foi possível carregar as sessões.') +
                '</small></li>';
            return;
        }
        lista.innerHTML =
            r.sessoes
                .map(
                    (s) =>
                        '<li><div><b>' +
                        esc(s.disciplina) +
                        '</b><small>' +
                        esc(dataLonga(s.data)) +
                        '</small></div><span class="h">' +
                        horas(s.minutos) +
                        '</span></li>'
                )
                .join('') || '<li><small>Nenhuma sessão guardada neste certificado.</small></li>';
        total.innerHTML =
            '<span>' +
            r.sessoes.length +
            (r.sessoes.length === 1 ? ' sessão' : ' sessões') +
            ' com presença confirmada</span><b>' +
            horas(r.carga_minutos) +
            '</b>';
    }

    function abrirRevogar(c) {
        document.getElementById('rev-sub').textContent =
            c.monitor +
            ' · ' +
            c.periodo +
            ' · ' +
            horas(c.carga_minutos) +
            ' · código ' +
            codigoLegivel(c.codigo);
        const motivo = document.getElementById('rev-motivo');
        motivo.value = '';
        document.getElementById('rev-erro').textContent = '';
        document.getElementById('rev-confirmar').dataset.id = c.id;
        dlgRev.showModal();
        motivo.focus();
    }

    async function executar(botao, rota, corpo, sucesso) {
        botao.disabled = true;
        let r;
        try {
            r = await chamadaApi(rota, {
                method: 'POST',
                body: corpo ? JSON.stringify(corpo) : undefined
            });
        } catch {
            r = { success: false, erro: 'Não foi possível conectar ao servidor.' };
        }
        botao.disabled = false;
        if (!r.success) {
            showToast(mensagemDaApi(r, 'Não foi possível concluir. Tente de novo.'), 'error');
            return null;
        }
        if (r.registro) S.auditoria.unshift(r.registro);
        showToast(sucesso, 'success');
        return r;
    }

    async function assinar(id, botao) {
        const c = S.certificados.pendente.find((x) => x.id === id);
        if (!c) return;
        const r = await executar(
            botao,
            '/admin/certificados/' + id + '/assinar',
            null,
            'Certificado de ' + c.monitor + ' assinado. O monitor recebe um e-mail.'
        );
        if (!r) return;
        S.certificados.pendente = S.certificados.pendente.filter((x) => x.id !== id);
        if (c.periodo === S.periodo) S.certificados.assinado.unshift(r.certificado);
        const m = S.monitores.find((x) => x.nome === c.monitor);
        if (m && c.periodo === S.periodo) m.certificado = 'assinado';
        if (dlgSes.open) dlgSes.close();
        render();
    }

    document
        .getElementById('ses-assinar')
        .addEventListener('click', (ev) =>
            assinar(Number(ev.currentTarget.dataset.id), ev.currentTarget)
        );

    document.getElementById('rev-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('rev-confirmar');
        const id = Number(b.dataset.id);
        const motivo = document.getElementById('rev-motivo').value.trim();
        if (motivo.length < 10) {
            document.getElementById('rev-erro').textContent =
                'Escreva o motivo com pelo menos 10 caracteres. Ele vai no e-mail para o monitor.';
            return;
        }
        const c = S.certificados.assinado.find((x) => x.id === id);
        const r = await executar(
            b,
            '/admin/certificados/' + id + '/revogar',
            { motivo },
            'Certificado revogado. O código já aparece como revogado na verificação.'
        );
        if (!r) return;
        S.certificados.assinado = S.certificados.assinado.filter((x) => x.id !== id);
        const m = c && S.monitores.find((x) => x.nome === c.monitor);
        if (m) m.certificado = 'nenhum';
        dlgRev.close();
        render();
    });

    // ---------- disciplinas: aprovar e mesclar ----------
    const dlgMes = document.getElementById('dlg-mesclar');

    function abrirMesclar(d) {
        document.getElementById('mes-sub').textContent =
            '"' +
            d.nome +
            '"' +
            (d.criador ? ', pedida por ' + d.criador : '') +
            ' · ' +
            d.vagas +
            (d.vagas === 1 ? ' vaga' : ' vagas');
        const sel = document.getElementById('mes-destino');
        sel.innerHTML = S.aprovadas
            .map(
                (x) =>
                    '<option value="' +
                    x.id +
                    '"' +
                    (d.parecida && x.id === d.parecida.id ? ' selected' : '') +
                    '>' +
                    esc(x.nome) +
                    '</option>'
            )
            .join('');
        document.getElementById('mes-confirmar').dataset.id = d.id;
        dlgMes.showModal();
    }

    async function aprovarDisciplina(id, botao) {
        const d = S.disciplinas.find((x) => x.id === id);
        if (!d) return;
        const r = await executar(
            botao,
            '/admin/disciplinas/' + id + '/aprovar',
            null,
            '"' + d.nome + '" aprovada. Os alunos já veem a disciplina e as vagas.'
        );
        if (!r) return;
        S.disciplinas = S.disciplinas.filter((x) => x.id !== id);
        S.aprovadas = S.aprovadas
            .concat({ id: d.id, nome: d.nome })
            .sort((a, b) => a.nome.localeCompare(b.nome));
        render();
    }

    document.getElementById('mes-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('mes-confirmar');
        const id = Number(b.dataset.id);
        const destino = Number(document.getElementById('mes-destino').value);
        const alvo = S.aprovadas.find((x) => x.id === destino);
        const r = await executar(
            b,
            '/admin/disciplinas/' + id + '/mesclar',
            { id_destino: destino },
            'Disciplinas mescladas. As vagas agora aparecem em ' +
                (alvo ? alvo.nome : 'outra disciplina') +
                '.'
        );
        if (!r) return;
        S.disciplinas = S.disciplinas.filter((x) => x.id !== id);
        dlgMes.close();
        render();
    });

    // ---------- faltas: marcar e anular ----------
    const dlgAnu = document.getElementById('dlg-anular');
    const dlgFal = document.getElementById('dlg-falta');
    const descricaoSessao = (x) =>
        x.aluno + ' · ' + x.disciplina + ' com ' + x.monitor + ' · ' + dataHora(x.horario);

    function abrirAnular(x) {
        document.getElementById('anu-sub').textContent = descricaoSessao(x);
        const motivo = document.getElementById('anu-motivo');
        motivo.value = '';
        document.getElementById('anu-erro').textContent = '';
        document.getElementById('anu-confirmar').dataset.id = x.id;
        dlgAnu.showModal();
        motivo.focus();
    }

    function abrirMarcar(x) {
        document.getElementById('fal-sub').textContent = descricaoSessao(x);
        document.getElementById('fal-confirmar').dataset.id = x.id;
        dlgFal.showModal();
    }

    document.getElementById('anu-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('anu-confirmar');
        const id = Number(b.dataset.id);
        const motivo = document.getElementById('anu-motivo').value.trim();
        if (motivo.length < 10) {
            document.getElementById('anu-erro').textContent =
                'Escreva a justificativa com pelo menos 10 caracteres. Ela fica no registro de atividade.';
            return;
        }
        const r = await executar(
            b,
            '/admin/agendamentos/' + id + '/anular-falta',
            { motivo },
            'Falta anulada. O bloqueio do aluno, se houver, já foi recalculado.'
        );
        if (!r) return;
        dlgAnu.close();
        carregar();
    });

    document.getElementById('fal-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('fal-confirmar');
        const r = await executar(
            b,
            '/admin/agendamentos/' + Number(b.dataset.id) + '/falta',
            null,
            'Falta marcada. Ela aparece no perfil do aluno.'
        );
        if (!r) return;
        dlgFal.close();
        S.filtroFalta = 'faltas';
        carregar();
    });

    // ---------- recursos de falta: aceitar e recusar ----------
    const dlgRecusar = document.getElementById('dlg-recusar');
    async function aceitarRecurso(id, botao) {
        const x = S.faltas.recursos.find((r) => r.id === id);
        if (!x) return;
        const r = await executar(
            botao,
            '/admin/recursos/' + id + '/aceitar',
            null,
            'Pedido aceito e falta anulada. ' + x.aluno + ' recebe a resposta por e-mail.'
        );
        if (r) carregar();
    }
    function abrirRecusar(x) {
        document.getElementById('rcs-sub').textContent =
            x.aluno + ' · ' + x.disciplina + ' · ' + dataHora(x.horario);
        const motivo = document.getElementById('rcs-motivo');
        motivo.value = '';
        document.getElementById('rcs-erro').textContent = '';
        document.getElementById('rcs-confirmar').dataset.id = x.id;
        dlgRecusar.showModal();
        motivo.focus();
    }
    document.getElementById('rcs-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('rcs-confirmar');
        const motivo = document.getElementById('rcs-motivo').value.trim();
        if (motivo.length < 10) {
            document.getElementById('rcs-erro').textContent =
                'Escreva o motivo com pelo menos 10 caracteres. O aluno recebe esse texto por e-mail.';
            return;
        }
        const r = await executar(
            b,
            '/admin/recursos/' + Number(b.dataset.id) + '/recusar',
            { motivo },
            'Pedido recusado. O aluno recebe o motivo por e-mail.'
        );
        if (!r) return;
        dlgRecusar.close();
        carregar();
    });

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
            if (S.aba === 'certificados') S.filtroCert = 'pendente';
            if (S.aba === 'faltas') S.filtroFalta = 'recursos';
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
            return;
        }
        const ff = ev.target.closest('[data-pn-falta]');
        if (ff) {
            S.filtroFalta = ff.dataset.pnFalta;
            render();
            return;
        }
        const fc = ev.target.closest('[data-pn-cert]');
        if (fc) {
            S.filtroCert = fc.dataset.pnCert;
            render();
            return;
        }
        const b = ev.target.closest('[data-pn]');
        if (!b) return;
        const id = Number(b.dataset.id);
        if (b.dataset.pn === 'sessoes')
            return abrirSessoes(S.certificados.pendente.find((x) => x.id === id));
        if (b.dataset.pn === 'assinar') return assinar(id, b);
        if (b.dataset.pn === 'revogar')
            return abrirRevogar(S.certificados.assinado.find((x) => x.id === id));
        if (b.dataset.pn === 'mesclar') return abrirMesclar(S.disciplinas.find((x) => x.id === id));
        if (b.dataset.pn === 'aprovar') return aprovarDisciplina(id, b);
        if (b.dataset.pn === 'anular') return abrirAnular(S.faltas.faltas.find((x) => x.id === id));
        if (b.dataset.pn === 'aceitar-recurso') return aceitarRecurso(id, b);
        if (b.dataset.pn === 'recusar-recurso')
            return abrirRecusar(S.faltas.recursos.find((x) => x.id === id));
        if (b.dataset.pn === 'marcar-falta')
            return abrirMarcar(S.faltas.sem_presenca.find((x) => x.id === id));
    });

    carregar();
});
