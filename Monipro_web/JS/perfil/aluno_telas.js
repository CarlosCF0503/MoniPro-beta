// JS/perfil/aluno_telas.js
// Perfil do aluno: montagem do computador (opção A: coluna lateral e três abas) e do celular
// (opção C: abas no rodapé). As duas usam o mesmo estado; as peças vêm de JS/perfil/aluno.js.

import { escaparHtml } from '../api.js';
import { PerfilDados } from './dados.js';
import { icone } from './comum.js';
import { PerfilExcluirConta } from './excluir_conta.js';

const D = PerfilDados;
const esc = escaparHtml;

/**
 * Monta as duas telas do perfil do aluno a partir do estado `S` e das peças de cada inscrição.
 */
export function criarTelasAluno({
    S,
    situacao,
    confirmadas,
    textoMudou,
    posicaoTexto,
    SITUACOES,
    podeAvaliar,
    botaoAvaliar,
    paraAvaliar,
    etiqueta,
    quando,
    notaPresenca,
    botaoConfirmar,
    localHTML,
    acoes,
    pontosHTML,
    comoGanharHTML,
    estadoHTML,
    temDados,
    avisoRestricao
}) {
    // --- 5. Computador (opção A) ---
    function itemInscricao(i) {
        const sit = situacao(i);
        const nota = notaPresenca(i);
        return (
            '<li class="vaga' +
            (sit === 'confirmar' ? ' vaga-atencao' : '') +
            '">' +
            '<div class="dt" aria-hidden="true"><span class="dt-sem">' +
            D.DIAS_SEMANA[i.inicio.getDay()] +
            '</span><span class="dt-dia">' +
            String(i.inicio.getDate()).padStart(2, '0') +
            '</span><span class="dt-mes">' +
            D.MESES_CURTOS[i.inicio.getMonth()] +
            '</span></div>' +
            '<div class="vg-info"><div class="vg-topo"><h3>' +
            esc(i.disciplina) +
            '</h3>' +
            etiqueta(i) +
            '</div><div class="vg-meta">' +
            '<span>' +
            icone('relogio') +
            '<span class="sr-only">' +
            D.diaMes(i.inicio) +
            ', </span>' +
            quando(i) +
            '</span><span>' +
            localHTML(i) +
            '</span><span>' +
            icone('pessoa') +
            esc(i.monitor) +
            '</span></div>' +
            (nota ? '<p class="pp-nota-presenca">' + nota + '</p>' : '') +
            // Quem só saiu da fila já tem a nota acima ("Você entrou pela lista de espera")
            (sit === 'antes' && i.liberado && (D.mudancasDaVaga(i).length || !i.promovido)
                ? '<p class="pp-nota-presenca">' + esc(textoMudou(i)) + '</p>'
                : '') +
            '</div>' +
            acoes(i) +
            '</li>'
        );
    }

    function telaDesktop(L) {
        // Abre em "Para confirmar" quando há o que confirmar
        if (temDados() && (!S.abaEscolhida || (S.aba === 'confirmar' && !L.confirmar.length)))
            S.aba = L.confirmar.length ? 'confirmar' : 'proximas';
        if (!S.aba) S.aba = 'confirmar';
        const abas = [
            ['confirmar', 'Para confirmar', L.confirmar],
            ['proximas', 'Próximas', L.proximas],
            ['historico', 'Histórico', L.historico]
        ];
        const u = S.usuario;
        const nome = u ? u.nome_completo || 'Aluno' : 'Carregando…';

        let painel;
        if (!temDados()) painel = estadoHTML();
        else {
            const lista = L[S.aba];
            const dica = {
                confirmar:
                    'Monitorias que já aconteceram. Confirme a sua presença para ganhar os pontos.',
                proximas: 'Em ordem de data, da mais próxima para a mais distante.',
                historico: 'Presenças confirmadas, aguardando o monitor e encerradas.'
            }[S.aba];
            const vazio = {
                confirmar: 'Tudo em dia. Nenhuma presença esperando a sua confirmação.',
                proximas: 'Nenhuma monitoria marcada. Escolha uma disciplina para marcar.',
                historico: 'As monitorias que já passaram aparecem aqui.'
            }[S.aba];
            painel = lista.length
                ? '<p class="pp-dica">' +
                  dica +
                  '</p><ul class="vagas-lista">' +
                  lista.map(itemInscricao).join('') +
                  '</ul>'
                : '<p class="pp-vazio">' + vazio + '</p>';
        }

        const numeros = temDados()
            ? [L.confirmar.length, L.proximas.length, confirmadas()]
            : S.carregando
              ? ['…', '…', '…']
              : S.erro
                ? ['–', '–', '–']
                : [0, 0, 0];
        const rotulos = ['Para confirmar', 'Próximas monitorias', 'Presenças confirmadas'];

        return (
            '<div class="pp-desk">' +
            '<a class="pp-voltar" href="base.html">' +
            icone('esquerda', 16) +
            'Início</a>' +
            '<div class="pp-cabecalho"><div><h1>Meu perfil</h1><p>Suas monitorias, sua presença e seus pontos.</p></div>' +
            '<a class="pp-btn pp-btn-pri" href="escolha_disciplina.html">' +
            icone('mais', 18) +
            'Marcar monitoria</a></div>' +
            '<div class="pp-grade"><div class="pp-lateral">' +
            '<section class="pp-cartao pp-id" aria-label="Seus dados">' +
            '<div class="avatar" aria-hidden="true">' +
            esc(u ? D.iniciais(u.nome_completo) : '') +
            '</div><h2 class="pp-nome">' +
            esc(nome) +
            '</h2><div class="pp-chips"><span class="chip chip-papel">Aluno</span>' +
            pontosHTML() +
            '</div><ul class="pp-dados">' +
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
            '<section class="pp-cartao pp-cert" aria-labelledby="h-pontos"><h2 id="h-pontos">Pontos</h2>' +
            comoGanharHTML() +
            '</section></div>' +
            '<div class="pp-principal">' +
            avisoRestricao() +
            '<div class="pp-numeros" aria-label="Resumo">' +
            numeros
                .map(
                    (n, k) =>
                        '<div class="pp-cartao pp-numero' +
                        (k === 0 && temDados() && L.confirmar.length ? ' atencao' : '') +
                        '"><span class="n">' +
                        esc(n) +
                        '</span><span class="l">' +
                        rotulos[k] +
                        '</span></div>'
                )
                .join('') +
            '</div>' +
            '<section class="pp-cartao pp-vagas" aria-labelledby="h-insc"><h2 id="h-insc">Minhas monitorias</h2>' +
            '<div class="pp-abas" role="tablist" aria-label="Filtrar monitorias">' +
            abas
                .map(
                    ([k, t, arr]) =>
                        '<button type="button" class="pp-aba" role="tab" id="aba-' +
                        k +
                        '" aria-selected="' +
                        (S.aba === k) +
                        '" aria-controls="painel-insc" tabindex="' +
                        (S.aba === k ? 0 : -1) +
                        '" data-aba="' +
                        k +
                        '">' +
                        t +
                        (temDados()
                            ? '<span class="cnt' +
                              (k === 'confirmar' && arr.length ? ' atencao' : '') +
                              '">' +
                              arr.length +
                              '</span>'
                            : '') +
                        '</button>'
                )
                .join('') +
            '</div><div id="painel-insc" role="tabpanel" aria-labelledby="aba-' +
            S.aba +
            '">' +
            painel +
            '</div></section></div></div></div>'
        );
    }

    // --- 6. Celular (opção C) ---
    function linhaCel(i) {
        const sit = situacao(i);
        let sub;
        if (sit === 'fila')
            sub =
                '<span class="lc-presenca">Lista de espera · ' +
                posicaoTexto(i) +
                '</span> · ' +
                D.hora(i.inicio);
        else if (sit === 'antes')
            sub =
                (i.liberado
                    ? '<span class="lc-presenca">' +
                      (D.mudancasDaVaga(i).length || !i.promovido
                          ? 'Vaga alterada'
                          : 'Saiu da fila') +
                      '</span> · '
                    : '') +
                D.hora(i.inicio) +
                ' · ' +
                esc(i.monitor);
        else if (sit === 'confirmar')
            sub =
                '<span class="lc-presenca">Prazo: ' +
                D.diaMes(D.limiteConfirmacao({ inicio: i.inicio })) +
                '</span>';
        else {
            const [classe, , texto] = SITUACOES[sit];
            const ponto = classe === 'pill-ok' ? 'ok' : classe === 'pill-perigo' ? 'perigo' : '';
            sub = '<span class="ponto ' + ponto + '"></span>' + texto;
        }
        const avaliar = sit === 'confirmada' && podeAvaliar(i);
        return (
            '<li class="lc' +
            (sit === 'confirmar' ? ' lc-atencao' : '') +
            '"><button type="button" class="lc-main" data-acao="detalhes" data-id="' +
            esc(i.id) +
            '"><span class="lc-data"><b>' +
            String(i.inicio.getDate()).padStart(2, '0') +
            '</b>' +
            D.MESES_CURTOS[i.inicio.getMonth()] +
            '</span><span class="lc-texto"><span class="lc-titulo">' +
            esc(i.disciplina) +
            '</span><span class="lc-sub">' +
            sub +
            '</span></span>' +
            (sit === 'confirmar' || avaliar ? '' : icone('direita', 18)) +
            '</button>' +
            (sit === 'confirmar' ? botaoConfirmar(i, 'lc-acao', 'Confirmar') : '') +
            (avaliar ? botaoAvaliar(i, 'lc-acao lc-acao-sec', 'Avaliar') : '') +
            '</li>'
        );
    }
    function historicoCel(L) {
        if (!L.historico.length)
            return '<p class="pp-vazio">As monitorias que já passaram aparecem aqui.</p>';
        return (
            '<p class="lc-resumo">' +
            D.plural(confirmadas(), 'presença confirmada', 'presenças confirmadas') +
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
                .join('')
        );
    }
    function telaMonitoriasCel(L) {
        let corpo;
        if (!temDados()) corpo = estadoHTML();
        else if (S.filtroCel === 'historico') corpo = historicoCel(L);
        else
            corpo =
                (L.confirmar.length
                    ? '<h2 class="lc-secao atencao">Para confirmar · ' +
                      L.confirmar.length +
                      '</h2><ul class="lc-lista">' +
                      L.confirmar.map(linhaCel).join('') +
                      '</ul>'
                    : '') +
                (paraAvaliar(L).length
                    ? '<h2 class="lc-secao">Para avaliar · ' +
                      paraAvaliar(L).length +
                      '</h2><ul class="lc-lista">' +
                      paraAvaliar(L).map(linhaCel).join('') +
                      '</ul>'
                    : '') +
                '<h2 class="lc-secao">Próximas · ' +
                L.proximas.length +
                '</h2>' +
                (L.proximas.length
                    ? '<ul class="lc-lista">' + L.proximas.map(linhaCel).join('') + '</ul>'
                    : '<p class="pp-vazio">Nenhuma monitoria marcada.</p>');
        const filtro = temDados()
            ? '<div class="seg-fixo"><div class="seg" role="tablist" aria-label="Filtrar monitorias">' +
              '<button type="button" role="tab" id="filtro-aberto" aria-selected="' +
              (S.filtroCel === 'aberto') +
              '" data-filtro="aberto">Em aberto' +
              (L.confirmar.length ? '<i class="selo">' + L.confirmar.length + '</i>' : '') +
              '</button><button type="button" role="tab" id="filtro-historico" aria-selected="' +
              (S.filtroCel === 'historico') +
              '" data-filtro="historico">Histórico</button></div></div>'
            : '';
        return (
            '<div class="cel-topo"><h1>Minhas monitorias</h1><a class="pp-btn pp-btn-pri pp-btn-p" href="escolha_disciplina.html">' +
            icone('mais', 16) +
            'Marcar</a></div>' +
            avisoRestricao() +
            filtro +
            '<div class="cel-corpo"' +
            (temDados() ? ' role="tabpanel" aria-labelledby="filtro-' + S.filtroCel + '"' : '') +
            '>' +
            corpo +
            '</div>'
        );
    }
    function telaPontosCel() {
        let topo;
        if (S.carregando) topo = '<div class="pp-esqueleto" aria-hidden="true"><span></span></div>';
        else if (S.erro) topo = estadoHTML();
        else {
            const porDisc = D.presencasPorDisciplina(S.inscricoes);
            const max = porDisc.length ? porDisc[0].n : 1;
            const n = confirmadas();
            topo =
                '<div class="horas-total"><span class="n">' +
                esc(S.usuario ? Number(S.usuario.pontos) || 0 : 0) +
                ' pontos</span><span class="l">' +
                (n
                    ? D.plural(n, 'presença confirmada', 'presenças confirmadas')
                    : 'Confirme suas presenças para somar pontos.') +
                '</span></div>' +
                (porDisc.length
                    ? '<ul class="horas-barras">' +
                      porDisc
                          .map(
                              (x) =>
                                  '<li><span class="bl">' +
                                  esc(x.disciplina) +
                                  '</span><span class="bv">' +
                                  D.plural(x.n, 'presença', 'presenças') +
                                  '</span><span class="bb" aria-hidden="true"><i style="width:' +
                                  Math.round((x.n / max) * 100) +
                                  '%"></i></span></li>'
                          )
                          .join('') +
                      '</ul>'
                    : '');
        }
        return (
            '<div class="cel-topo"><h1>Pontos</h1></div><div class="cel-corpo">' +
            topo +
            '<h2 class="lc-secao">Extrato de pontos</h2>' +
            comoGanharHTML() +
            '</div>'
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
            '</strong><div class="pp-chips"><span class="chip chip-papel">Aluno</span>' +
            pontosHTML() +
            '</div></div><dl class="cel-dl"><div><dt>E-mail</dt><dd>' +
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
            S.abaCel === 'pontos'
                ? telaPontosCel()
                : S.abaCel === 'perfil'
                  ? telaPerfilCel()
                  : telaMonitoriasCel(L);
        const abas = [
            ['monitorias', 'Monitorias', 'calendario'],
            ['pontos', 'Pontos', 'moeda'],
            ['perfil', 'Perfil', 'pessoa']
        ];
        return (
            '<div class="pp-cel">' +
            tela +
            '<nav class="cel-abas" aria-label="Seções do perfil">' +
            abas
                .map(
                    ([k, t, ic]) =>
                        '<button type="button" data-aba-cel="' +
                        k +
                        '" aria-current="' +
                        (S.abaCel === k ? 'page' : 'false') +
                        '">' +
                        icone(ic, 22) +
                        '<span>' +
                        t +
                        '</span>' +
                        (k === 'monitorias' && temDados() && L.confirmar.length
                            ? '<i class="selo-aba">' +
                              L.confirmar.length +
                              '<span class="sr-only"> para confirmar</span></i>'
                            : '') +
                        '</button>'
                )
                .join('') +
            '</nav></div>'
        );
    }

    return { telaDesktop, telaCelular };
}
