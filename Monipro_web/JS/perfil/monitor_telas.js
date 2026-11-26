// JS/perfil/monitor_telas.js
// Perfil do monitor: montagem do computador (opção A: coluna lateral e três abas) e do celular
// (opção C: abas no rodapé). As duas usam o mesmo estado; as peças vêm de JS/perfil/monitor.js.

import { escaparHtml } from '../api.js';
import { PerfilDados } from './dados.js';
import { icone } from './comum.js';
import { PerfilExcluirConta } from './excluir_conta.js';

const D = PerfilDados;
const esc = escaparHtml;

/**
 * Monta as duas telas do perfil do monitor a partir do estado `S` e das peças de cada vaga.
 */
export function criarTelasMonitor({
    S,
    textoHoras,
    textoInscritos,
    barraInscritos,
    etiqueta,
    botaoFinalizar,
    aConfirmar,
    avisoPresencas,
    acoes,
    certificadosHTML,
    avaliacoesHTML,
    pontosHTML,
    linkRanking,
    estadoHTML,
    temDados,
    maisAntigas
}) {
    // --- 5. Computador (opção A) ---
    function itemVaga(v) {
        const g = D.grupo(v, S.agora);
        const quando = v.fim ? D.hora(v.inicio) + '–' + D.hora(v.fim) : D.hora(v.inicio);
        return (
            '<li class="vaga' +
            (g === 'finalizar' ? ' vaga-atencao' : '') +
            '">' +
            '<div class="dt" aria-hidden="true"><span class="dt-sem">' +
            D.DIAS_SEMANA[v.inicio.getDay()] +
            '</span><span class="dt-dia">' +
            String(v.inicio.getDate()).padStart(2, '0') +
            '</span><span class="dt-mes">' +
            D.MESES_CURTOS[v.inicio.getMonth()] +
            '</span></div>' +
            '<div class="vg-info"><div class="vg-topo"><h3>' +
            esc(v.disciplina) +
            '</h3>' +
            etiqueta(v) +
            '</div><div class="vg-meta">' +
            '<span>' +
            icone('relogio') +
            '<span class="sr-only">' +
            D.diaMes(v.inicio) +
            ', </span>' +
            quando +
            '</span>' +
            '<span>' +
            (v.online ? icone('video') + 'On-line' : icone('local') + esc(v.local)) +
            '</span>' +
            '<span class="cap' +
            (v.inscritos !== null && v.inscritos >= v.capacidade ? ' cap-cheia' : '') +
            '">' +
            icone('pessoas') +
            textoInscritos(v) +
            barraInscritos(v) +
            '</span></div></div>' +
            acoes(v) +
            '</li>'
        );
    }

    function telaDesktop(L) {
        // Abre em "Para finalizar" quando há o que finalizar. Só decide com os dados na tela:
        // durante o carregamento a lista está vazia e a escolha ficaria presa em "Próximas".
        if (temDados() && (!S.abaEscolhida || (S.aba === 'finalizar' && !L.finalizar.length)))
            S.aba = L.finalizar.length ? 'finalizar' : 'proximas';
        if (!S.aba) S.aba = 'finalizar';
        const abas = [
            ['finalizar', 'Para finalizar', L.finalizar],
            ['proximas', 'Próximas', L.proximas],
            ['historico', 'Histórico', L.historico]
        ];
        const u = S.usuario;
        const nome = u ? u.nome_completo || 'Monitor' : 'Carregando…';

        let painel;
        if (!temDados()) painel = estadoHTML();
        else {
            const lista =
                S.aba === 'finalizar'
                    ? L.finalizar
                    : S.aba === 'proximas'
                      ? L.proximas
                      : L.historico;
            const dica = {
                finalizar: 'Vagas cujo horário já passou. Finalize para registrar as horas.',
                proximas: 'Em ordem de data, da mais próxima para a mais distante.',
                historico: 'Vagas realizadas e canceladas, da mais recente para a mais antiga.'
            }[S.aba];
            const vazio = {
                finalizar: 'Tudo em dia. Nenhuma vaga esperando finalização.',
                proximas: 'Nenhuma vaga marcada. Abra uma para os alunos poderem se inscrever.',
                historico: 'Vagas finalizadas e canceladas aparecem aqui.'
            }[S.aba];
            painel =
                (S.aba === 'historico' ? '' : avisoPresencas(L, 'data-aba')) +
                (lista.length
                    ? '<p class="pp-dica">' +
                      dica +
                      '</p><ul class="vagas-lista">' +
                      lista.map(itemVaga).join('') +
                      '</ul>' +
                      (S.aba === 'historico' ? maisAntigas() : '')
                    : '<p class="pp-vazio">' + vazio + '</p>');
        }

        const numeros = temDados()
            ? [L.finalizar.length, L.proximas.length, textoHoras()]
            : S.carregando
              ? ['…', '…', '…']
              : S.erro
                ? ['–', '–', '–']
                : [0, 0, '0h'];
        const rotulos = ['Para finalizar', 'Próximas vagas', 'Horas no semestre'];

        return (
            '<div class="pp-desk">' +
            '<a class="pp-voltar" href="base.html">' +
            icone('esquerda', 16) +
            'Início</a>' +
            '<div class="pp-cabecalho"><div><h1>Meu perfil</h1><p>Suas vagas, suas horas e seus certificados.</p></div>' +
            '<a class="pp-btn pp-btn-pri" href="escolha_disciplina.html">' +
            icone('mais', 18) +
            'Abrir nova vaga</a></div>' +
            '<div class="pp-grade"><div class="pp-lateral">' +
            '<section class="pp-cartao pp-id" aria-label="Seus dados">' +
            '<div class="avatar" aria-hidden="true">' +
            esc(u ? D.iniciais(u.nome_completo) : '') +
            '</div><h2 class="pp-nome">' +
            esc(nome) +
            '</h2><div class="pp-chips"><span class="chip chip-papel">Monitor</span>' +
            pontosHTML() +
            '</div>' +
            linkRanking() +
            '<ul class="pp-dados">' +
            '<li><span class="pp-dados-ico">' +
            icone('email', 16) +
            '</span><span><small>E-mail</small>' +
            esc(u ? u.email : '') +
            '</span></li>' +
            '<li><span class="pp-dados-ico">' +
            icone('matricula', 16) +
            '</span><span><small>Matrícula</small>' +
            esc(u ? u.matricula : '') +
            '</span></li></ul>' +
            // R3 (LGPD): Aviso de Privacidade e "Excluir minha conta" (excluir_conta.js)
            (u ? PerfilExcluirConta.blocoHTML() : '') +
            '</section>' +
            '<section class="pp-cartao pp-cert" aria-labelledby="h-cert"><h2 id="h-cert">Certificados</h2>' +
            certificadosHTML() +
            '</section>' +
            '<section class="pp-cartao pp-aval" aria-labelledby="h-aval"><h2 id="h-aval">Avaliações</h2>' +
            avaliacoesHTML() +
            '</section></div>' +
            '<div class="pp-principal">' +
            '<div class="pp-numeros" aria-label="Resumo">' +
            numeros
                .map(
                    (n, i) =>
                        '<div class="pp-cartao pp-numero' +
                        (i === 0 && temDados() && L.finalizar.length ? ' atencao' : '') +
                        '"><span class="n">' +
                        esc(n) +
                        '</span><span class="l">' +
                        rotulos[i] +
                        '</span></div>'
                )
                .join('') +
            '</div>' +
            '<section class="pp-cartao pp-vagas" aria-labelledby="h-vagas"><h2 id="h-vagas">Minhas vagas</h2>' +
            '<div class="pp-abas" role="tablist" aria-label="Filtrar vagas">' +
            abas
                .map(
                    ([k, t, arr]) =>
                        '<button type="button" class="pp-aba" role="tab" id="aba-' +
                        k +
                        '" aria-selected="' +
                        (S.aba === k) +
                        '" aria-controls="painel-vagas" tabindex="' +
                        (S.aba === k ? 0 : -1) +
                        '" data-aba="' +
                        k +
                        '">' +
                        t +
                        (temDados()
                            ? '<span class="cnt' +
                              (k === 'finalizar' && arr.length ? ' atencao' : '') +
                              '">' +
                              arr.length +
                              '</span>'
                            : '') +
                        '</button>'
                )
                .join('') +
            '</div><div id="painel-vagas" role="tabpanel" aria-labelledby="aba-' +
            S.aba +
            '">' +
            painel +
            '</div></section></div></div></div>'
        );
    }

    // --- 6. Celular (opção C) ---
    function linhaCel(v) {
        const g = D.grupo(v, S.agora);
        let sub;
        if (g === 'historico')
            sub = D.realizada(v)
                ? '<span class="ponto ok"></span>Realizada' +
                  (v.fim ? ' · ' + D.duracao((v.fim - v.inicio) / 60000) : '')
                : '<span class="ponto perigo"></span>Cancelada';
        else sub = D.hora(v.inicio) + ' · ' + textoInscritos(v, true);
        const n = aConfirmar(v);
        if (n)
            sub +=
                ' · <span class="lc-presenca">' +
                D.plural(n, 'presença', 'presenças') +
                ' a confirmar</span>';
        return (
            '<li class="lc' +
            (g === 'finalizar' ? ' lc-atencao' : '') +
            '"><button type="button" class="lc-main" data-acao="detalhes" data-id="' +
            esc(v.id) +
            '"><span class="lc-data"><b>' +
            String(v.inicio.getDate()).padStart(2, '0') +
            '</b>' +
            D.MESES_CURTOS[v.inicio.getMonth()] +
            '</span><span class="lc-texto"><span class="lc-titulo">' +
            esc(v.disciplina) +
            '</span><span class="lc-sub">' +
            sub +
            '</span></span>' +
            (g === 'finalizar' ? '' : icone('direita', 18)) +
            '</button>' +
            (g === 'finalizar' ? botaoFinalizar(v, 'Finalizar', 'lc-acao') : '') +
            '</li>'
        );
    }
    function historicoCel(L) {
        if (!L.historico.length)
            return '<p class="pp-vazio">Vagas finalizadas e canceladas aparecem aqui.</p>';
        const real = L.historico.filter(D.realizada).length;
        const canc = L.historico.length - real;
        const resumo = [
            D.plural(real, 'realizada', 'realizadas'),
            canc ? D.plural(canc, 'cancelada', 'canceladas') : '',
            textoHoras() + ' comprovadas no semestre'
        ]
            .filter(Boolean)
            .join(' · ');
        return (
            '<p class="lc-resumo">' +
            resumo +
            '</p>' +
            D.agruparPorMes(L.historico)
                .map(
                    (g) =>
                        '<h2 class="lc-secao">' +
                        g.rotulo +
                        '</h2><ul class="lc-lista">' +
                        g.vagas.map(linhaCel).join('') +
                        '</ul>'
                )
                .join('') +
            maisAntigas()
        );
    }
    function telaVagasCel(L) {
        let corpo;
        if (!temDados()) corpo = estadoHTML();
        else if (S.filtroCel === 'historico') corpo = historicoCel(L);
        else
            corpo =
                avisoPresencas(L, 'data-filtro') +
                (L.finalizar.length
                    ? '<h2 class="lc-secao atencao">Para finalizar · ' +
                      L.finalizar.length +
                      '</h2><ul class="lc-lista">' +
                      L.finalizar.map(linhaCel).join('') +
                      '</ul>'
                    : '') +
                '<h2 class="lc-secao">Próximas · ' +
                L.proximas.length +
                '</h2>' +
                (L.proximas.length
                    ? '<ul class="lc-lista">' + L.proximas.map(linhaCel).join('') + '</ul>'
                    : '<p class="pp-vazio">Nenhuma vaga marcada.</p>');
        const filtro = temDados()
            ? '<div class="seg-fixo"><div class="seg" role="tablist" aria-label="Filtrar vagas">' +
              '<button type="button" role="tab" id="filtro-aberto" aria-selected="' +
              (S.filtroCel === 'aberto') +
              '" data-filtro="aberto">Em aberto' +
              (L.finalizar.length ? '<i class="selo">' + L.finalizar.length + '</i>' : '') +
              '</button><button type="button" role="tab" id="filtro-historico" aria-selected="' +
              (S.filtroCel === 'historico') +
              '" data-filtro="historico">Histórico</button></div></div>'
            : '';
        return (
            '<div class="cel-topo"><h1>Minhas vagas</h1><a class="pp-btn pp-btn-pri pp-btn-p" href="escolha_disciplina.html">' +
            icone('mais', 16) +
            'Nova vaga</a></div>' +
            filtro +
            '<div class="cel-corpo"' +
            (temDados() ? ' role="tabpanel" aria-labelledby="filtro-' + S.filtroCel + '"' : '') +
            '>' +
            corpo +
            '</div>'
        );
    }
    function telaHorasCel() {
        let topo;
        if (S.carregando) topo = '<div class="pp-esqueleto" aria-hidden="true"><span></span></div>';
        else if (S.erro) topo = estadoHTML();
        else {
            const porDisc = S.horas ? S.horas.por_disciplina : [];
            const max = porDisc.length ? porDisc[0].minutos : 1;
            const n = S.horas ? S.horas.sessoes : 0;
            topo =
                '<div class="horas-total"><span class="n">' +
                textoHoras() +
                '</span><span class="l">' +
                (n
                    ? 'comprovadas em ' + D.plural(n, 'monitoria', 'monitorias') + ' neste semestre'
                    : 'Finalize monitorias com presença confirmada para somar horas.') +
                '</span></div>' +
                (porDisc.length
                    ? '<ul class="horas-barras">' +
                      porDisc
                          .map(
                              (x) =>
                                  '<li><span class="bl">' +
                                  esc(x.disciplina) +
                                  '</span><span class="bv">' +
                                  D.duracao(x.minutos) +
                                  '</span><span class="bb" aria-hidden="true"><i style="width:' +
                                  Math.round((x.minutos / max) * 100) +
                                  '%"></i></span></li>'
                          )
                          .join('') +
                      '</ul>'
                    : '');
        }
        return (
            '<div class="cel-topo"><h1>Horas e certificados</h1></div><div class="cel-corpo">' +
            topo +
            '<h2 class="lc-secao">Certificados</h2>' +
            certificadosHTML() +
            '<h2 class="lc-secao">Avaliações</h2>' +
            '<div class="pp-aval pp-aval-cel">' +
            avaliacoesHTML() +
            '</div></div>'
        );
    }
    function telaPerfilCel() {
        const u = S.usuario;
        return (
            '<div class="cel-topo"><h1>Meus dados</h1></div><div class="cel-corpo">' +
            '<div class="cel-id"><div class="avatar" aria-hidden="true">' +
            esc(u ? D.iniciais(u.nome_completo) : '') +
            '</div><strong>' +
            esc(u ? u.nome_completo : S.erro ? '—' : 'Carregando…') +
            '</strong><div class="pp-chips"><span class="chip chip-papel">Monitor</span>' +
            pontosHTML() +
            '</div>' +
            linkRanking() +
            '</div><dl class="cel-dl"><div><dt>E-mail</dt><dd>' +
            esc(u ? u.email : '—') +
            '</dd></div><div><dt>Matrícula</dt><dd>' +
            esc(u ? u.matricula : '—') +
            '</dd></div></dl>' +
            (u ? PerfilExcluirConta.blocoHTML() : '') +
            '</div>'
        );
    }
    function telaCelular(L) {
        const tela =
            S.abaCel === 'horas'
                ? telaHorasCel()
                : S.abaCel === 'perfil'
                  ? telaPerfilCel()
                  : telaVagasCel(L);
        const abas = [
            ['vagas', 'Vagas', 'calendario'],
            ['horas', 'Horas', 'relogio'],
            ['perfil', 'Perfil', 'pessoa']
        ];
        return (
            '<div class="pp-cel">' +
            tela +
            '<nav class="cel-abas" aria-label="Seções do perfil">' +
            abas
                .map(
                    ([k, t, i]) =>
                        '<button type="button" data-aba-cel="' +
                        k +
                        '" aria-current="' +
                        (S.abaCel === k ? 'page' : 'false') +
                        '">' +
                        icone(i, 22) +
                        '<span>' +
                        t +
                        '</span>' +
                        (k === 'vagas' && temDados() && L.finalizar.length
                            ? '<i class="selo-aba">' +
                              L.finalizar.length +
                              '<span class="sr-only"> para finalizar</span></i>'
                            : '') +
                        '</button>'
                )
                .join('') +
            '</nav></div>'
        );
    }

    return { telaDesktop, telaCelular };
}
