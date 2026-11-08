// JS/perfil/aluno.js
// Perfil do aluno, com a mesma montagem do perfil do monitor (JS/perfil/monitor.js):
// - >= 700px (opção A): dados e pontos numa coluna lateral; monitorias em três abas
//   (Para confirmar, Próximas, Histórico) com contagem.
// - < 700px (opção C): abas no rodapé (Monitorias, Pontos, Perfil); Monitorias tem o filtro
//   "Em aberto / Histórico" e os detalhes abrem num painel que sobe do rodapé.
// P2 (R4): depois de cada sessão o aluno confirma a própria presença; com a confirmação do
// monitor também, ele ganha os pontos.
// Depende de: api.js (chamadaApi, mensagemDaApi, escaparHtml), toast.js, perfil/dados.js.

document.addEventListener('DOMContentLoaded', async () => {
    const D = window.PerfilDados;
    const esc = escaparHtml;
    const raiz = document.getElementById('perfil-app');
    const celularMq = window.matchMedia('(max-width: 699px)');
    const celular = () => celularMq.matches;
    if (!raiz || !D) return;

    // --- 1. Sessão ---
    // P3 (R7): quem está logado vem de GET /auth/sessao (o token fica no cookie httpOnly)
    let usuarioSessao;
    try {
        usuarioSessao = await obterSessao();
    } catch (erro) {
        showToast(erro.message || 'Falha na comunicação com o servidor.', 'error', erro);
        return;
    }
    if (!usuarioSessao) {
        showToast('Sessão expirada. Faça login novamente.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return;
    }
    if (usuarioSessao.tipo === 'monitor') {
        window.location.href = 'perfil_monitor.html';
        return;
    }

    // --- 2. Estado ---
    const LIMITE = 100; // máximo aceito por utils/paginacao.js
    const S = {
        carregando: true,
        erro: null,
        usuario: null,
        inscricoes: [],
        agora: new Date(),
        aba: null, // computador: confirmar | proximas | historico
        abaEscolhida: false,
        abaCel: 'monitorias', // celular: monitorias | pontos | perfil
        filtroCel: 'aberto', // celular, aba Monitorias: aberto | historico
        alvo: null,
        gatilho: null
    };

    // --- 3. Ícones (os mesmos do perfil do monitor) ---
    const ICONES = {
        relogio: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
        local: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
        pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
        calendario:
            '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        ok: '<polyline points="20 6 9 17 4 12"/>',
        x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        moeda: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 10h5M9.5 14h5"/>',
        email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
        matricula:
            '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/>',
        direita: '<polyline points="9 18 15 12 9 6"/>',
        esquerda: '<polyline points="15 18 9 12 15 6"/>',
        semRede:
            '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'
    };
    function icone(nome, tamanho) {
        const t = tamanho || 14;
        return (
            '<svg class="ico" width="' +
            t +
            '" height="' +
            t +
            '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            ICONES[nome] +
            '</svg>'
        );
    }

    // --- 4. Peças ---
    const listas = () => D.separarInscricoes(S.inscricoes, S.agora);
    const situacao = (i) => D.situacaoDoAluno(i, S.agora);
    const confirmadas = () => S.inscricoes.filter((i) => i.status === 'concluido').length;
    const AVISO_24H = 'Cancelamento só até ' + D.HORAS_CANCELAMENTO + 'h antes';
    const SITUACOES = {
        confirmar: ['pill-atencao', 'relogio', 'Confirme sua presença'],
        antes: ['pill-aberta', 'calendario', 'Inscrito'],
        aguardando: ['pill-aberta', 'relogio', 'Aguardando o monitor'],
        confirmada: ['pill-ok', 'ok', 'Presença confirmada'],
        expirada: ['pill-perigo', 'x', 'Presença não confirmada'],
        cancelada: ['pill-perigo', 'x', 'Vaga cancelada']
    };
    function etiqueta(i) {
        const [classe, ico, texto] = SITUACOES[situacao(i)];
        return '<span class="pill ' + classe + '">' + icone(ico, 12) + texto + '</span>';
    }
    function quando(i) {
        return i.fim ? D.hora(i.inicio) + '–' + D.hora(i.fim) : D.hora(i.inicio);
    }
    function limiteTexto(i) {
        const lim = D.limiteConfirmacao({ inicio: i.inicio });
        return D.diaMes(lim) + ' às ' + D.hora(lim);
    }
    // Nota curta sobre a presença, conforme o que já foi confirmado
    function notaPresenca(i) {
        const sit = situacao(i);
        if (sit === 'confirmar')
            return i.monitorConfirmou
                ? 'O monitor já confirmou. Confirme até ' +
                      limiteTexto(i) +
                      ' para ganhar +' +
                      D.PONTOS_ALUNO +
                      ' pontos.'
                : 'Confirme até ' +
                      limiteTexto(i) +
                      '. Os pontos entram quando o monitor também confirmar.';
        if (sit === 'aguardando')
            return (
                'Você confirmou. Os +' +
                D.PONTOS_ALUNO +
                ' pontos entram quando o monitor confirmar.'
            );
        if (sit === 'expirada')
            return 'O prazo de ' + D.DIAS_CONFIRMACAO + ' dias para confirmar terminou.';
        return '';
    }
    // rotulo: na linha do celular o botão diz só "Confirmar" (o aria-label leva o texto completo)
    function botaoConfirmar(i, classe, rotulo) {
        return (
            '<button type="button" class="' +
            classe +
            '" data-acao="presenca" data-id="' +
            esc(i.id) +
            '" aria-label="Confirmar presença em ' +
            esc(i.disciplina) +
            '">' +
            (rotulo || 'Confirmar presença') +
            '</button>'
        );
    }
    function botaoCancelar(i) {
        return (
            '<button type="button" class="pp-btn pp-btn-texto-perigo" data-acao="cancelar" data-id="' +
            esc(i.id) +
            '">Cancelar inscrição</button>'
        );
    }
    function acoes(i) {
        const sit = situacao(i);
        if (sit === 'confirmar')
            return '<div class="vg-acoes">' + botaoConfirmar(i, 'pp-btn pp-btn-pri') + '</div>';
        if (sit === 'antes')
            return (
                '<div class="vg-acoes">' +
                (D.podeCancelarInscricao(i, S.agora)
                    ? botaoCancelar(i)
                    : '<span class="nota-24h">' + icone('relogio', 12) + AVISO_24H + '</span>') +
                '</div>'
            );
        return '';
    }
    function pontosHTML() {
        const pts = S.usuario ? Number(S.usuario.pontos) || 0 : 0;
        return (
            '<span class="chip chip-pontos" title="Pontos de gamificação">' +
            icone('moeda', 14) +
            esc(pts) +
            ' pontos</span>'
        );
    }
    function comoGanharHTML() {
        return (
            '<div class="cert-vazio">' +
            icone('moeda', 22) +
            '<p><strong>Como ganhar pontos</strong>Depois de cada monitoria, confirme a sua presença aqui. Quando o monitor também confirmar, você ganha +' +
            D.PONTOS_ALUNO +
            ' pontos. O prazo é de ' +
            D.DIAS_CONFIRMACAO +
            ' dias.</p></div>'
        );
    }
    function estadoHTML() {
        if (S.carregando)
            return (
                '<div class="pp-esqueleto" aria-hidden="true"><span></span><span></span><span></span></div>' +
                '<p class="pp-dica">Carregando suas monitorias…</p>'
            );
        if (S.erro)
            return (
                '<div class="pp-estado erro"><div class="pp-estado-ico">' +
                icone('semRede', 28) +
                '</div><h3>Não foi possível carregar suas monitorias</h3><p>' +
                esc(S.erro) +
                '</p><button type="button" class="pp-btn pp-btn-sec" data-acao="recarregar">Tentar de novo</button></div>'
            );
        return (
            '<div class="pp-estado"><div class="pp-estado-ico">' +
            icone('calendario', 28) +
            '</div><h3>Você ainda não marcou nenhuma monitoria</h3><p>Escolha uma disciplina e um horário com um monitor. A inscrição aparece aqui.</p>' +
            '<a class="pp-btn pp-btn-pri" href="escolha_disciplina.html">' +
            icone('mais', 18) +
            'Marcar monitoria</a></div>'
        );
    }
    const temDados = () => !S.carregando && !S.erro && S.inscricoes.length > 0;

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
            icone('local') +
            esc(i.local) +
            '</span><span>' +
            icone('pessoa') +
            esc(i.monitor) +
            '</span></div>' +
            (nota ? '<p class="pp-nota-presenca">' + nota + '</p>' : '') +
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
            '</span></li></ul></section>' +
            '<section class="pp-cartao pp-cert" aria-labelledby="h-pontos"><h2 id="h-pontos">Pontos</h2>' +
            comoGanharHTML() +
            '</section></div>' +
            '<div class="pp-principal">' +
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
        if (sit === 'antes') sub = D.hora(i.inicio) + ' · ' + esc(i.monitor);
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
            (sit === 'confirmar' ? '' : icone('direita', 18)) +
            '</button>' +
            (sit === 'confirmar' ? botaoConfirmar(i, 'lc-acao', 'Confirmar') : '') +
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
            '<h2 class="lc-secao">Como ganhar pontos</h2>' +
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
            '</dd></div></dl></div>'
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

    // --- 7. Desenho ---
    function render() {
        S.agora = new Date();
        const L = listas();
        raiz.setAttribute('aria-busy', String(S.carregando));
        raiz.innerHTML = celular() ? telaCelular(L) : telaDesktop(L);
        document.body.classList.toggle('pp-com-abas', celular());
        document
            .querySelectorAll('.pp-dlg')
            .forEach((d) => d.classList.toggle('pp-painel', celular()));
    }
    celularMq.addEventListener('change', render);

    // --- 8. Carga ---
    function sessaoExpirada() {
        showToast('Sessão expirada. Faça login novamente.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }
    async function carregar() {
        S.carregando = true;
        S.erro = null;
        render();
        try {
            const [perfil, lista] = await Promise.all([
                chamadaApi('/perfil'),
                chamadaApi('/perfil/agendamentos?limit=' + LIMITE + '&page=1')
            ]);
            if (perfil.statusHttp === 401 || lista.statusHttp === 401) return sessaoExpirada();
            if (!perfil.success || !perfil.user)
                throw new Error(mensagemDaApi(perfil, 'Não foi possível carregar seus dados.'));
            if (!lista.success)
                throw new Error(mensagemDaApi(lista, 'Não foi possível carregar suas monitorias.'));
            S.usuario = perfil.user;
            S.inscricoes = (lista.agendamentos || []).map(D.normalizarMinhaInscricao);
        } catch (erro) {
            S.erro = erro.message || 'Falha na comunicação com o servidor.';
            console.error('[MoniPro] Erro ao carregar o perfil do aluno.', erro);
        }
        S.carregando = false;
        render();
    }

    // --- 9. Diálogos ---
    const dlgCan = document.getElementById('dlg-cancelar');
    const dlgDet = document.getElementById('dlg-detalhes');
    const inscricaoPorId = (id) => S.inscricoes.find((i) => String(i.id) === String(id));

    function preencherDetalhes(i) {
        const sit = situacao(i);
        document.getElementById('det-titulo').textContent = i.disciplina;
        let acoesDet = '';
        if (sit === 'confirmar')
            acoesDet =
                '<div class="pp-det-acoes">' + botaoConfirmar(i, 'pp-btn pp-btn-pri') + '</div>';
        else if (sit === 'antes')
            acoesDet = D.podeCancelarInscricao(i, S.agora)
                ? '<div class="pp-det-acoes">' + botaoCancelar(i) + '</div>'
                : '<p class="nota-24h nota-bloco">' +
                  icone('relogio', 14) +
                  AVISO_24H +
                  '. Faltam menos de ' +
                  D.HORAS_CANCELAMENTO +
                  'h para o início.</p>';
        const nota = notaPresenca(i);
        document.getElementById('det-corpo').innerHTML =
            '<span id="det-situacao" tabindex="-1">' +
            etiqueta(i) +
            '</span>' +
            '<dl class="cel-dl"><div><dt>Data</dt><dd>' +
            D.diaCurto(i.inicio) +
            '</dd></div><div><dt>Horário</dt><dd>' +
            quando(i) +
            '</dd></div><div><dt>Local</dt><dd>' +
            esc(i.local) +
            '</dd></div><div><dt>Monitor</dt><dd>' +
            esc(i.monitor) +
            '</dd></div></dl>' +
            (nota ? '<p class="pp-insc-nota">' + nota + '</p>' : '') +
            acoesDet;
    }
    function abrirDetalhes(i) {
        S.alvo = i;
        preencherDetalhes(i);
        dlgDet.showModal();
    }
    dlgDet.addEventListener('click', (ev) => {
        if (ev.target === dlgDet) dlgDet.close(); // toque fora do painel
    });

    // P2 (R4): PATCH /agendamentos/:id/presenca, feito pelo próprio aluno
    async function confirmarPresenca(botao) {
        const i = inscricaoPorId(botao.dataset.id);
        if (!i) return;
        const noDialogo = Boolean(botao.closest('dialog'));
        botao.disabled = true;
        botao.textContent = 'Confirmando…';
        try {
            const dados = await chamadaApi('/agendamentos/' + i.id + '/presenca', {
                method: 'PATCH'
            });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (dados.erro || !dados.success) {
                showToast(
                    mensagemDaApi(dados, 'Não foi possível confirmar a presença.'),
                    'error',
                    dados
                );
                botao.disabled = false;
                botao.textContent = 'Confirmar presença';
                return;
            }
            i.alunoConfirmou = true;
            if (dados.concluido) {
                i.status = 'concluido';
                if (S.usuario) S.usuario.pontos = (Number(S.usuario.pontos) || 0) + D.PONTOS_ALUNO;
            }
            render();
            if (noDialogo) {
                preencherDetalhes(i);
                document.getElementById('det-situacao').focus();
            } else {
                const alvo = raiz.querySelector('[aria-selected="true"]');
                if (alvo) alvo.focus();
            }
            showToast(dados.mensagem || 'Presença registrada.', 'success');
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
            botao.disabled = false;
            botao.textContent = 'Confirmar presença';
        }
    }

    function abrirCancelar(i) {
        S.alvo = i;
        document.getElementById('can-sub').textContent =
            i.disciplina + ' · ' + D.diaCurto(i.inicio) + ' às ' + D.hora(i.inicio);
        dlgCan.showModal();
    }
    document.getElementById('can-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const i = S.alvo;
        if (!i) return;
        const botao = document.getElementById('can-confirmar');
        botao.disabled = true;
        try {
            const dados = await chamadaApi('/agendamentos/' + i.id, { method: 'DELETE' });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (dados.erro || !dados.success) {
                dlgCan.close();
                showToast(
                    mensagemDaApi(dados, 'Não foi possível cancelar a inscrição.'),
                    'error',
                    dados
                );
                return;
            }
            S.inscricoes = S.inscricoes.filter((x) => x !== i);
            dlgCan.close();
            render();
            showToast('Inscrição cancelada.', 'success');
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
        } finally {
            botao.disabled = false;
        }
    });

    // Fechar pelos botões "Voltar"/X e devolver o foco a quem abriu
    document.addEventListener('click', (ev) => {
        const b = ev.target.closest('.pp-dlg [data-fechar]');
        if (b) b.closest('dialog').close();
    });
    [dlgCan, dlgDet].forEach((d) =>
        d.addEventListener('close', () => {
            if (document.querySelector('.pp-dlg[open]')) return;
            if (S.gatilho && document.body.contains(S.gatilho)) S.gatilho.focus();
            else {
                const alvo = raiz.querySelector('[aria-selected="true"], h1');
                if (alvo) alvo.focus({ preventScroll: true });
            }
        })
    );

    // --- 10. Ações da tela ---
    function trocarAba(chave) {
        S.aba = chave;
        S.abaEscolhida = true;
        render();
        document.getElementById('aba-' + chave).focus();
    }
    function aoAgir(ev) {
        const aba = ev.target.closest('[data-aba]');
        if (aba) return trocarAba(aba.dataset.aba);
        const filtro = ev.target.closest('[data-filtro]');
        if (filtro) {
            S.filtroCel = filtro.dataset.filtro;
            render();
            return document.getElementById('filtro-' + S.filtroCel).focus();
        }
        const abaCel = ev.target.closest('[data-aba-cel]');
        if (abaCel) {
            S.abaCel = abaCel.dataset.abaCel;
            render();
            window.scrollTo(0, 0);
            return raiz.querySelector('[data-aba-cel="' + S.abaCel + '"]').focus();
        }
        const b = ev.target.closest('[data-acao]');
        if (!b) return;
        const acao = b.dataset.acao;
        if (acao === 'recarregar') return carregar();
        if (acao === 'presenca') return confirmarPresenca(b);
        const i = inscricaoPorId(b.dataset.id);
        if (!i) return;
        const deDentro = b.closest('dialog');
        if (deDentro) deDentro.close();
        else S.gatilho = b;
        if (acao === 'detalhes') abrirDetalhes(i);
        else if (acao === 'cancelar') abrirCancelar(i);
    }
    raiz.addEventListener('click', aoAgir);
    dlgDet.addEventListener('click', aoAgir);

    // Abas do computador pelo teclado (setas, Home, End)
    raiz.addEventListener('keydown', (ev) => {
        if (!ev.target.closest('.pp-abas')) return;
        const ordem = ['confirmar', 'proximas', 'historico'];
        let k = ordem.indexOf(S.aba);
        if (ev.key === 'ArrowRight') k = (k + 1) % 3;
        else if (ev.key === 'ArrowLeft') k = (k + 2) % 3;
        else if (ev.key === 'Home') k = 0;
        else if (ev.key === 'End') k = 2;
        else return;
        ev.preventDefault();
        trocarAba(ordem[k]);
    });

    carregar();
});
