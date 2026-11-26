// JS/painel/abas.js
// Plano 7 (RF-012): abas de gestão do painel da coordenação. Só montam HTML a partir do estado;
// os cliques de cada aba são tratados em JS/painel.js.

import { escaparHtml, MB_BETA_ORM } from '../api.js';
import { horas, pct, dataCurta, dataHora, ico, ICO, presencaBaixa } from './formato.js';

const esc = escaparHtml;

/**
 * Monta as abas de gestão do painel (monitores, certificados, disciplinas, faltas, avaliações e
 * atividade) a partir do estado `S` (só leitura).
 */
export function criarAbas({ S }) {
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
                ['Avaliação', 'num'],
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
                    (m.avaliacao && m.avaliacao.media != null
                        ? '<span class="pn-nota">' +
                          String(m.avaliacao.media.toFixed(1)).replace('.', ',') +
                          ' ★</span><small>' +
                          m.avaliacao.total +
                          (m.avaliacao.total === 1 ? ' avaliação' : ' avaliações') +
                          '</small>'
                        : '<small>' +
                          (m.avaliacao && m.avaliacao.total ? 'menos de 3' : 'sem avaliações') +
                          '</small>') +
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

    // Plano 6: comentários das avaliações; a coordenação oculta o que for ofensivo ou pessoal (decisão
    // de 21/11). Decisão de 22/11: a nota do comentário oculto sai da média, do total e da distribuição
    function abaAvaliacoes() {
        const f = S.filtroAval;
        const visiveis = S.avaliacoes.filter((x) => !x.oculto_em);
        const ocultos = S.avaliacoes.filter((x) => x.oculto_em);
        const lista = f === 'ocultos' ? ocultos : visiveis;
        const filtro =
            '<div class="pn-filtro" role="group" aria-label="Comentários">' +
            [
                ['visiveis', 'Visíveis ao monitor', visiveis.length],
                ['ocultos', 'Ocultos', ocultos.length]
            ]
                .map(
                    ([k, t, n]) =>
                        '<button type="button" data-pn-aval="' +
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
        const nota = (n) =>
            '<span class="pn-nota-chip' + (n <= 2 ? ' baixa' : '') + '">' + n + '/5</span>';
        return (
            filtro +
            '<p class="pn-dica">Comentários deixados pelos alunos no semestre. O monitor vê sem o nome do aluno. Oculte só o que for ofensivo ou pessoal: o comentário some para o monitor e a nota dele deixa de contar na média.</p>' +
            tabela(
                [['Comentário'], ['Monitor'], ['Nota'], ['', 'num']],
                lista.map(
                    (x) =>
                        '<tr><td class="pn-just">' +
                        esc(x.comentario) +
                        '<small>' +
                        esc(x.disciplina) +
                        ' · ' +
                        dataCurta(x.criado_em) +
                        (x.oculto_em ? ' · oculto em ' + dataCurta(x.oculto_em) : '') +
                        '</small></td><td>' +
                        esc(x.monitor) +
                        '</td><td>' +
                        nota(x.nota) +
                        '</td><td><div class="pn-acoes">' +
                        (x.oculto_em
                            ? '<button type="button" class="pp-btn pp-btn-sec pp-btn-p" data-pn="reexibir" data-id="' +
                              x.id +
                              '">Mostrar de novo</button>'
                            : '<button type="button" class="pp-btn pp-btn-texto-perigo pp-btn-p" data-pn="ocultar" data-id="' +
                              x.id +
                              '">Ocultar</button>') +
                        '</div></td></tr>'
                ),
                f === 'ocultos' ? 'Nenhum comentário oculto.' : 'Nenhum comentário neste semestre.'
            )
        );
    }

    function abaAtividade() {
        const tipo = {
            criar_coordenador: [ICO.pessoa, ''],
            convidar_coordenador: [ICO.pessoa, ''],
            assinar_certificado: [ICO.pena, 'ok'],
            revogar_certificado: [ICO.x, 'perigo'],
            aprovar_disciplina: [ICO.ok, 'ok'],
            mesclar_disciplina: [ICO.juntar, ''],
            marcar_falta: [ICO.alerta, 'perigo'],
            anular_falta: [ICO.ok, 'ok'],
            aceitar_recurso: [ICO.ok, 'ok'],
            recusar_recurso: [ICO.x, 'perigo'],
            ocultar_avaliacao: [ICO.x, 'perigo'],
            reexibir_avaliacao: [ICO.ok, 'ok']
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
            ['avaliacoes', 'Avaliações', S.avaliacoes.filter((x) => !x.oculto_em).length, false],
            ['atividade', 'Atividade', null, false]
        ];
        const corpo = {
            certificados: abaCertificados,
            disciplinas: abaDisciplinas,
            faltas: abaFaltas,
            avaliacoes: abaAvaliacoes,
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

    return { codigoLegivel, gestao };
}
