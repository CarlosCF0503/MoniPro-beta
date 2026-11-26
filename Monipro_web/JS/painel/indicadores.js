// JS/painel/indicadores.js
// Plano 7 (RF-012): topo do painel da coordenação (pendências, indicadores e os quatro gráficos).
// Só montam HTML a partir do estado; as abas de gestão ficam em JS/painel/abas.js e a carga dos
// dados e os cliques, em JS/painel.js.
// Os gráficos são SVG/HTML montados aqui: a CSP do site só aceita scripts do próprio domínio.

import { escaparHtml } from '../api.js';
import { horas, pct, milhar, FUSO, dataCurta, ico, ICO, presencaBaixa } from './formato.js';

const esc = escaparHtml;

/**
 * Monta o HTML do topo do painel a partir do estado `S` (só leitura).
 */
export function criarIndicadores({ S }) {
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

    return {
        pendencias,
        kpis,
        graficoSemanas,
        graficoDisciplinas,
        graficoInscricoes,
        graficoHorarios
    };
}
