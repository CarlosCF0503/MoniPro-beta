// JS/perfil/monitor.js
// Perfil do monitor. Montagem decidida pelo time:
// - >= 700px (opção A): dados e certificados numa coluna lateral; vagas em três abas
//   (Para finalizar, Próximas, Histórico) com contagem.
// - < 700px (opção C): abas no rodapé (Vagas, Horas, Perfil); Vagas tem o filtro
//   "Em aberto / Histórico" e os detalhes abrem num painel que sobe do rodapé.
// As duas montagens usam o mesmo estado, então girar o celular ou redimensionar não perde nada.
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
    if (usuarioSessao.tipo !== 'monitor') {
        window.location.href = 'perfil_aluno.html';
        return;
    }

    // --- 2. Estado ---
    const LIMITE = 100; // máximo aceito por utils/paginacao.js
    const S = {
        carregando: true,
        erro: null,
        usuario: null,
        vagas: [],
        total: 0,
        pagina: 0,
        carregandoMais: false,
        agora: new Date(),
        aba: null, // computador: finalizar | proximas | historico
        abaEscolhida: false, // true depois que o monitor troca de aba
        abaCel: 'vagas', // celular: vagas | horas | perfil
        filtroCel: 'aberto', // celular, aba Vagas: aberto | historico
        alvo: null,
        gatilho: null,
        // P2: inscrições das vagas do monitor, por vaga (Map idVaga -> lista)
        inscricoes: new Map(),
        inscricoesErro: false
    };

    // --- 3. Ícones (traço arredondado, currentColor, como no header) ---
    const ICONES = {
        relogio: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
        local: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
        pessoas:
            '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
        calendario:
            '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        ok: '<polyline points="20 6 9 17 4 12"/>',
        x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        medalha: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
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

    // --- 4. Pedaços comuns ---
    function listas() {
        return D.separar(S.vagas, S.agora);
    }
    function minutosComprovados() {
        return D.minutosComprovados(S.vagas);
    }
    // curto: na linha do celular, vaga cheia vira só "Lotada" (no computador a etiqueta já diz isso)
    function textoInscritos(v, curto) {
        if (v.inscritos === null) return 'Até ' + D.plural(v.capacidade, 'aluno', 'alunos');
        if (curto && v.inscritos >= v.capacidade) return 'Lotada';
        return v.inscritos + ' de ' + v.capacidade + ' inscritos';
    }
    function barraInscritos(v) {
        if (v.inscritos === null) return '';
        const pct = Math.min(100, Math.round((v.inscritos / v.capacidade) * 100));
        return (
            '<span class="cap-barra" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'
        );
    }
    function etiqueta(v) {
        const g = D.grupo(v, S.agora);
        if (g === 'finalizar')
            return (
                '<span class="pill pill-atencao">' +
                icone('relogio', 12) +
                'Aguardando finalização</span>'
            );
        if (D.realizada(v)) {
            const dur = v.fim ? ' · ' + D.duracao((v.fim - v.inicio) / 60000) : '';
            return '<span class="pill pill-ok">' + icone('ok', 12) + 'Realizada' + dur + '</span>';
        }
        if (v.status === 'cancelada')
            return '<span class="pill pill-perigo">' + icone('x', 12) + 'Cancelada</span>';
        if (v.inscritos !== null && v.inscritos >= v.capacidade)
            return '<span class="pill pill-ok">' + icone('pessoas', 12) + 'Lotada</span>';
        return '<span class="pill pill-aberta">' + icone('calendario', 12) + 'Aberta</span>';
    }
    function botaoFinalizar(v, rotulo, classe) {
        return (
            '<button type="button" class="' +
            classe +
            '" data-acao="finalizar" data-id="' +
            esc(v.id) +
            '">' +
            rotulo +
            '</button>'
        );
    }
    function botaoCancelar(v) {
        return (
            '<button type="button" class="pp-btn pp-btn-texto-perigo" data-acao="cancelar" data-id="' +
            esc(v.id) +
            '">Cancelar vaga</button>'
        );
    }
    const AVISO_24H = 'Cancelamento só até ' + D.HORAS_CANCELAMENTO + 'h antes';
    // P2 (R4): presença confirmada pelo monitor depois do início da sessão (D1)
    const inscricoesDa = (v) => S.inscricoes.get(v.id) || [];
    const aConfirmar = (v) => D.presencasAConfirmar(inscricoesDa(v), v, S.agora);
    // Aviso quando há presenças a confirmar em vagas do Histórico (já finalizadas), que não
    // aparecem na aba aberta. atributo: 'data-aba' (computador) ou 'data-filtro' (celular).
    function avisoPresencas(L, atributo) {
        const n = L.historico.reduce((soma, v) => soma + aConfirmar(v), 0);
        if (!n) return '';
        return (
            '<div class="pp-aviso-presenca" role="status">' +
            icone('pessoas', 18) +
            '<span><strong>' +
            D.plural(n, 'presença a confirmar', 'presenças a confirmar') +
            '</strong> em vagas já finalizadas. O prazo é de ' +
            D.DIAS_CONFIRMACAO +
            ' dias depois de cada sessão.</span><button type="button" class="pp-btn pp-btn-sec pp-btn-p" ' +
            atributo +
            '="historico">Ver no Histórico</button></div>'
        );
    }
    function botaoPresencas(v) {
        const n = aConfirmar(v);
        if (!n) return '';
        return (
            '<button type="button" class="pp-btn pp-btn-sec" data-acao="detalhes" data-id="' +
            esc(v.id) +
            '">' +
            icone('ok', 16) +
            (n === 1 ? 'Confirmar presença' : 'Confirmar presenças (' + n + ')') +
            '</button>'
        );
    }
    function acoes(v) {
        const g = D.grupo(v, S.agora);
        if (g === 'finalizar')
            return (
                '<div class="vg-acoes">' +
                botaoPresencas(v) +
                botaoFinalizar(v, 'Finalizar', 'pp-btn pp-btn-pri') +
                '</div>'
            );
        if (g === 'historico') {
            const presencas = botaoPresencas(v);
            return presencas ? '<div class="vg-acoes">' + presencas + '</div>' : '';
        }
        if (g === 'proximas')
            return (
                '<div class="vg-acoes">' +
                botaoEditar(v) +
                (D.podeCancelar(v, S.agora)
                    ? botaoCancelar(v)
                    : '<span class="nota-24h">' + icone('relogio', 12) + AVISO_24H + '</span>') +
                '</div>'
            );
        return '';
    }
    function certificadosHTML() {
        return (
            '<div class="cert-vazio">' +
            icone('medalha', 22) +
            '<p><strong>Nenhum certificado ainda</strong>Cada monitoria finalizada soma horas comprovadas. A emissão da declaração de horas chega numa próxima versão.</p></div>'
        );
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
    function estadoHTML() {
        if (S.carregando)
            return (
                '<div class="pp-esqueleto" aria-hidden="true"><span></span><span></span><span></span></div>' +
                '<p class="pp-dica">Carregando suas vagas…</p>'
            );
        if (S.erro)
            return (
                '<div class="pp-estado erro"><div class="pp-estado-ico">' +
                icone('semRede', 28) +
                '</div><h3>Não foi possível carregar suas vagas</h3><p>' +
                esc(S.erro) +
                '</p><button type="button" class="pp-btn pp-btn-sec" data-acao="recarregar">Tentar de novo</button></div>'
            );
        return (
            '<div class="pp-estado"><div class="pp-estado-ico">' +
            icone('calendario', 28) +
            '</div><h3>Você ainda não abriu nenhuma vaga</h3><p>Escolha uma disciplina, um horário e um local. A vaga aparece aqui e na busca dos alunos.</p>' +
            '<a class="pp-btn pp-btn-pri" href="escolha_disciplina.html">' +
            icone('mais', 18) +
            'Abrir primeira vaga</a></div>'
        );
    }
    const temDados = () => !S.carregando && !S.erro && S.vagas.length > 0;
    function maisAntigas() {
        if (S.vagas.length >= S.total) return '';
        return (
            '<button type="button" class="pp-btn pp-btn-sec pp-mais" data-acao="mais"' +
            (S.carregandoMais ? ' disabled' : '') +
            '>' +
            (S.carregandoMais ? 'Carregando…' : 'Carregar vagas mais antigas') +
            '</button>'
        );
    }

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
            icone('local') +
            esc(v.local) +
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
            ? [L.finalizar.length, L.proximas.length, D.duracao(minutosComprovados())]
            : S.carregando
              ? ['…', '…', '…']
              : S.erro
                ? ['–', '–', '–']
                : [0, 0, '0h'];
        const rotulos = ['Para finalizar', 'Próximas vagas', 'Horas comprovadas'];

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
            '<section class="pp-cartao pp-cert" aria-labelledby="h-cert"><h2 id="h-cert">Certificados</h2>' +
            certificadosHTML() +
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
            D.duracao(minutosComprovados()) + ' comprovadas'
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
            const porDisc = D.horasPorDisciplina(S.vagas);
            const max = porDisc.length ? porDisc[0].minutos : 1;
            const n = S.vagas.filter(D.realizada).length;
            topo =
                '<div class="horas-total"><span class="n">' +
                D.duracao(minutosComprovados()) +
                '</span><span class="l">' +
                (n
                    ? 'comprovadas em ' + D.plural(n, 'monitoria', 'monitorias')
                    : 'Finalize monitorias para somar horas.') +
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
            '</strong><div class="pp-chips"><span class="chip chip-papel">Monitor</span>' +
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
            const [perfil, lista, inscricoes] = await Promise.all([
                chamadaApi('/perfil'),
                chamadaApi('/perfil/monitorias?limit=' + LIMITE + '&page=1'),
                // P2: sem a lista de inscritos o perfil continua funcionando; só some o botão
                chamadaApi('/monitorias/monitor/agendamentos?limit=' + LIMITE + '&page=1').catch(
                    () => null
                )
            ]);
            if (perfil.statusHttp === 401 || lista.statusHttp === 401) return sessaoExpirada();
            if (!perfil.success || !perfil.user)
                throw new Error(mensagemDaApi(perfil, 'Não foi possível carregar seus dados.'));
            if (!lista.success)
                throw new Error(mensagemDaApi(lista, 'Não foi possível carregar suas vagas.'));
            S.usuario = perfil.user;
            S.inscricoesErro = !inscricoes || !inscricoes.success;
            S.inscricoes = D.agruparInscricoes(
                ((inscricoes && inscricoes.agendamentos) || []).map(D.normalizarInscricao)
            );
            S.vagas = (lista.monitorias || []).map(D.normalizar);
            S.total = lista.paginacao ? lista.paginacao.total : S.vagas.length;
            S.pagina = 1;
        } catch (erro) {
            S.erro = erro.message || 'Falha na comunicação com o servidor.';
            console.error('[MoniPro] Erro ao carregar o perfil do monitor.', erro);
        }
        S.carregando = false;
        render();
    }
    async function carregarMais() {
        if (S.carregandoMais) return;
        S.carregandoMais = true;
        render();
        try {
            const lista = await chamadaApi(
                '/perfil/monitorias?limit=' + LIMITE + '&page=' + (S.pagina + 1)
            );
            if (!lista.success)
                throw new Error(mensagemDaApi(lista, 'Não foi possível carregar mais vagas.'));
            const ids = new Set(S.vagas.map((v) => v.id));
            (lista.monitorias || []).forEach((m) => {
                if (!ids.has(m.id)) S.vagas.push(D.normalizar(m));
            });
            S.total = lista.paginacao ? lista.paginacao.total : S.vagas.length;
            S.pagina += 1;
        } catch (erro) {
            showToast(erro.message || 'Não foi possível carregar mais vagas.', 'error', erro);
        }
        S.carregandoMais = false;
        render();
    }

    // --- 9. Diálogos ---
    const dlgFin = document.getElementById('dlg-finalizar');
    const dlgCan = document.getElementById('dlg-cancelar');
    const dlgDet = document.getElementById('dlg-detalhes');
    const vagaPorId = (id) => S.vagas.find((v) => String(v.id) === String(id));

    function presencasHTML(v) {
        if (v.status === 'cancelada') return '';
        const lista = inscricoesDa(v);
        let nota;
        if (S.inscricoesErro) nota = 'Não foi possível carregar os inscritos desta vaga.';
        else if (!lista.length) nota = 'Ninguém se inscreveu nesta vaga.';
        else if (S.agora < v.inicio)
            nota = 'Você poderá confirmar a presença dos alunos depois do início da sessão.';
        else if (S.agora > D.limiteConfirmacao(v))
            nota =
                'O prazo de ' +
                D.DIAS_CONFIRMACAO +
                ' dias para confirmar terminou em ' +
                D.diaMes(D.limiteConfirmacao(v)) +
                '.';
        else
            nota =
                'Confirme até ' +
                D.diaMes(D.limiteConfirmacao(v)) +
                ' às ' +
                D.hora(D.limiteConfirmacao(v)) +
                '. O aluno também confirma pelo perfil dele. Com as duas confirmações, você ganha +' +
                D.PONTOS_MONITOR +
                ' pontos e o aluno +' +
                D.PONTOS_ALUNO +
                '.';
        const itens = lista
            .map((i) => {
                const sit = D.situacaoPresenca(i, v, S.agora, 'monitor');
                let lado = '';
                if (sit === 'confirmar')
                    lado =
                        '<button type="button" class="pp-btn pp-btn-sec pp-btn-p" data-acao="presenca" data-id="' +
                        esc(v.id) +
                        '" data-ag="' +
                        esc(i.id) +
                        '" aria-label="Confirmar presença de ' +
                        esc(i.aluno) +
                        '">Confirmar presença</button>';
                else if (sit === 'confirmada')
                    lado =
                        '<span class="pill pill-ok" tabindex="-1" id="pres-' +
                        esc(i.id) +
                        '">' +
                        icone('ok', 12) +
                        'Presença confirmada</span>';
                else if (sit === 'aguardando')
                    lado =
                        '<span class="pp-insc-estado" tabindex="-1" id="pres-' +
                        esc(i.id) +
                        '">' +
                        icone('relogio', 12) +
                        'Aguardando o aluno</span>';
                else if (sit === 'expirada')
                    lado = '<span class="pp-insc-estado">Não confirmada</span>';
                return (
                    '<li><span class="pp-insc-nome">' +
                    icone('pessoa', 16) +
                    '<span>' +
                    esc(i.aluno) +
                    (sit === 'confirmar' && i.alunoConfirmou
                        ? '<small>Já confirmou a presença</small>'
                        : '') +
                    '</span></span>' +
                    lado +
                    '</li>'
                );
            })
            .join('');
        return (
            '<section class="pp-insc" aria-labelledby="insc-titulo"><h3 id="insc-titulo">Presença dos inscritos</h3><p class="pp-insc-nota">' +
            nota +
            '</p>' +
            (itens ? '<ul>' + itens + '</ul>' : '') +
            '</section>'
        );
    }

    function abrirDetalhes(v) {
        S.alvo = v;
        preencherDetalhes(v);
        dlgDet.showModal();
    }
    function preencherDetalhes(v) {
        const g = D.grupo(v, S.agora);
        document.getElementById('det-titulo').textContent = v.disciplina;
        let acoesDet = '';
        if (g === 'finalizar')
            acoesDet =
                '<div class="pp-det-acoes">' +
                botaoFinalizar(v, 'Finalizar monitoria', 'pp-btn pp-btn-pri') +
                '</div>';
        else if (g === 'proximas')
            acoesDet = D.podeCancelar(v, S.agora)
                ? '<div class="pp-det-acoes">' + botaoEditar(v) + botaoCancelar(v) + '</div>'
                : '<div class="pp-det-acoes">' +
                  botaoEditar(v) +
                  '</div><p class="nota-24h nota-bloco">' +
                  icone('relogio', 14) +
                  AVISO_24H +
                  '. Faltam menos de ' +
                  D.HORAS_CANCELAMENTO +
                  'h para o início.</p>';
        document.getElementById('det-corpo').innerHTML =
            etiqueta(v) +
            '<dl class="cel-dl"><div><dt>Data</dt><dd>' +
            D.diaCurto(v.inicio) +
            '</dd></div><div><dt>Horário</dt><dd>' +
            (v.fim ? D.hora(v.inicio) + '–' + D.hora(v.fim) : D.hora(v.inicio)) +
            '</dd></div><div><dt>Local</dt><dd>' +
            esc(v.local) +
            '</dd></div><div><dt>Inscritos</dt><dd>' +
            textoInscritos(v) +
            '</dd></div></dl>' +
            presencasHTML(v) +
            acoesDet;
    }

    // P2 (R4): PATCH /agendamentos/:id/concluir, feito pelo monitor dono da vaga
    async function confirmarPresenca(botao) {
        const vaga = vagaPorId(botao.dataset.id);
        const inscricao = vaga && inscricoesDa(vaga).find((i) => String(i.id) === botao.dataset.ag);
        if (!inscricao) return;
        botao.disabled = true;
        botao.textContent = 'Confirmando…';
        try {
            const dados = await chamadaApi('/agendamentos/' + inscricao.id + '/concluir', {
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
            inscricao.monitorConfirmou = true;
            if (dados.concluido) {
                inscricao.status = 'concluido';
                if (S.usuario)
                    S.usuario.pontos = (Number(S.usuario.pontos) || 0) + D.PONTOS_MONITOR;
            }
            render();
            preencherDetalhes(vaga);
            const marca = document.getElementById('pres-' + inscricao.id);
            if (marca) marca.focus();
            showToast(
                dados.mensagem || 'Presença de ' + inscricao.aluno + ' confirmada.',
                'success'
            );
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
            botao.disabled = false;
            botao.textContent = 'Confirmar presença';
        }
    }
    dlgDet.addEventListener('click', (ev) => {
        if (ev.target === dlgDet) dlgDet.close(); // toque fora do painel
    });

    // Término: caixa inteira clicável + lista curta (combobox/listbox), como em Marcar Monitoria
    const fimBtn = document.getElementById('fin-fim');
    const fimLista = document.getElementById('fin-lista');
    const fimValor = document.getElementById('fin-fim-valor');
    const finErro = document.getElementById('fin-erro');
    const finDuracao = document.getElementById('fin-duracao');
    const finConfirmar = document.getElementById('fin-confirmar');
    let fimMinutos = null;
    const itensFim = () => Array.from(fimLista.querySelectorAll('li'));

    function abrirFinalizar(v) {
        S.alvo = v;
        fimMinutos = null;
        document.getElementById('fin-sub').textContent =
            v.disciplina + ' · ' + D.diaCurto(v.inicio);
        document.getElementById('fin-inicio').textContent =
            v.inicio.toLocaleDateString('pt-BR') + ' às ' + D.hora(v.inicio);
        fimLista.innerHTML = D.opcoesTermino(v.inicio)
            .map(
                (o) =>
                    '<li role="option" id="fim-' +
                    o.minutos +
                    '" data-minutos="' +
                    o.minutos +
                    '" aria-selected="false">' +
                    o.hora +
                    '<span class="tag-dur">' +
                    D.duracao(o.minutos) +
                    '</span></li>'
            )
            .join('');
        fimLista.hidden = true;
        fimBtn.setAttribute('aria-expanded', 'false');
        fimBtn.removeAttribute('aria-invalid');
        finErro.textContent = '';
        mostrarTermino();
        finConfirmar.disabled = false;
        finConfirmar.textContent = 'Finalizar monitoria';
        dlgFin.showModal();
        fimBtn.focus();
    }
    function mostrarTermino() {
        if (fimMinutos === null) {
            fimValor.textContent = 'Escolher';
            fimValor.classList.add('sem-valor');
            finDuracao.textContent = 'Escolha o término para ver a duração.';
            return;
        }
        fimValor.textContent = D.hora(new Date(S.alvo.inicio.getTime() + fimMinutos * 60000));
        fimValor.classList.remove('sem-valor');
        finDuracao.innerHTML = 'Duração: <strong>' + D.duracao(fimMinutos) + '</strong>';
    }
    function escolherTermino(minutos) {
        fimMinutos = minutos;
        itensFim().forEach((x) =>
            x.setAttribute('aria-selected', String(Number(x.dataset.minutos) === minutos))
        );
        fimBtn.removeAttribute('aria-invalid');
        finErro.textContent = '';
        mostrarTermino();
    }
    // Marca o item ativo e rola só dentro da lista, sem mexer na página
    function marcarAtivo(item) {
        itensFim().forEach((x) => x.classList.toggle('ativo', x === item));
        if (!item) return;
        fimLista.setAttribute('aria-activedescendant', item.id);
        const topo = item.offsetTop;
        const base = topo + item.offsetHeight;
        if (topo < fimLista.scrollTop) fimLista.scrollTop = topo - 4;
        else if (base > fimLista.scrollTop + fimLista.clientHeight)
            fimLista.scrollTop = base - fimLista.clientHeight + 4;
    }
    function abrirListaFim() {
        fimLista.hidden = false;
        fimBtn.setAttribute('aria-expanded', 'true');
        // Abre para cima quando não cabe abaixo da caixa (painel no rodapé do celular)
        fimLista.classList.remove('para-cima');
        const r = fimBtn.getBoundingClientRect();
        const abaixo = window.innerHeight - r.bottom;
        if (abaixo < fimLista.offsetHeight + 8 && r.top > abaixo)
            fimLista.classList.add('para-cima');
        const itens = itensFim();
        // Abre centralizada no término escolhido (ou em 1h, o caso mais comum)
        const inicial =
            itens.find((x) => x.getAttribute('aria-selected') === 'true') ||
            itens.find((x) => x.dataset.minutos === '60') ||
            itens[0];
        fimLista.scrollTop = Math.max(
            inicial.offsetTop - fimLista.clientHeight / 2 + inicial.offsetHeight / 2,
            0
        );
        marcarAtivo(inicial);
        fimLista.focus({ preventScroll: true });
    }
    function fecharListaFim(devolverFoco) {
        if (fimLista.hidden) return;
        fimLista.hidden = true;
        fimBtn.setAttribute('aria-expanded', 'false');
        fimLista.removeAttribute('aria-activedescendant');
        if (devolverFoco) fimBtn.focus();
    }
    fimBtn.addEventListener('click', () => {
        if (fimLista.hidden) abrirListaFim();
        else fecharListaFim(true);
    });
    fimBtn.addEventListener('keydown', (ev) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(ev.key)) {
            ev.preventDefault();
            abrirListaFim();
        }
    });
    fimLista.addEventListener('click', (ev) => {
        const li = ev.target.closest('li');
        if (!li) return;
        escolherTermino(Number(li.dataset.minutos));
        fecharListaFim(true);
    });
    fimLista.addEventListener('keydown', (ev) => {
        const itens = itensFim();
        const atual = fimLista.querySelector('li.ativo');
        const mover = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 }[ev.key];
        if (mover) {
            ev.preventDefault();
            const i = Math.min(Math.max(itens.indexOf(atual) + mover, 0), itens.length - 1);
            marcarAtivo(itens[i]);
        } else if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            marcarAtivo(itens[ev.key === 'Home' ? 0 : itens.length - 1]);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            if (atual) {
                escolherTermino(Number(atual.dataset.minutos));
                fecharListaFim(true);
            }
        } else if (ev.key === 'Escape') {
            // Esc fecha só a lista, não o diálogo nem o menu do base.js
            ev.preventDefault();
            ev.stopPropagation();
            fecharListaFim(true);
        } else if (ev.key === 'Tab') {
            fecharListaFim(false);
        }
    });
    dlgFin.addEventListener('pointerdown', (ev) => {
        if (!ev.target.closest('.hora')) fecharListaFim(false);
    });
    dlgFin.addEventListener('close', () => fecharListaFim(false));
    dlgFin.querySelector('.pp-atalhos').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-minutos]');
        if (!b) return;
        escolherTermino(Number(b.dataset.minutos));
        fecharListaFim(false);
    });
    document.getElementById('fin-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!S.alvo) return;
        if (fimMinutos === null) {
            finErro.textContent = 'Escolha o horário de término.';
            fimBtn.setAttribute('aria-invalid', 'true');
            fimBtn.focus();
            return;
        }
        const vaga = S.alvo;
        const fim = new Date(vaga.inicio.getTime() + fimMinutos * 60000);
        finConfirmar.disabled = true;
        finConfirmar.textContent = 'Finalizando…';
        try {
            const dados = await chamadaApi('/monitorias/' + vaga.id + '/finalizar', {
                method: 'PATCH',
                body: JSON.stringify({ data_fim: fim.toISOString() })
            });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (dados.erro || !dados.success) {
                finErro.textContent = mensagemDaApi(
                    dados,
                    'Não foi possível finalizar a monitoria.'
                );
                return;
            }
            vaga.status = 'realizada';
            vaga.fim = fim;
            dlgFin.close();
            render();
            showToast(
                'Monitoria finalizada · ' + D.duracao(fimMinutos) + ' registradas.',
                'success'
            );
        } catch (erro) {
            finErro.textContent = 'Erro de rede. Verifique a conexão e tente de novo.';
            console.error('[MoniPro] Erro de rede ao finalizar a monitoria.', erro);
        } finally {
            finConfirmar.disabled = false;
            finConfirmar.textContent = 'Finalizar monitoria';
        }
    });

    function abrirCancelar(v) {
        S.alvo = v;
        document.getElementById('can-sub').textContent =
            v.disciplina + ' · ' + D.diaCurto(v.inicio) + ' às ' + D.hora(v.inicio);
        let aviso = 'Esta ação não pode ser desfeita.';
        if (v.inscritos)
            aviso =
                D.plural(v.inscritos, 'aluno inscrito perde', 'alunos inscritos perdem') +
                ' a vaga. ' +
                aviso;
        else if (v.inscritos === 0) aviso = 'Ninguém se inscreveu ainda. ' + aviso;
        document.getElementById('can-aviso').textContent = aviso;
        dlgCan.showModal();
    }
    document.getElementById('can-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const vaga = S.alvo;
        if (!vaga) return;
        const botao = document.getElementById('can-confirmar');
        botao.disabled = true;
        try {
            const dados = await chamadaApi('/monitorias/' + vaga.id + '/cancelar', {
                method: 'PUT'
            });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (dados.erro || !dados.success) {
                dlgCan.close();
                showToast(
                    mensagemDaApi(dados, 'Não foi possível cancelar a vaga.'),
                    'error',
                    dados
                );
                return;
            }
            vaga.status = 'cancelada';
            dlgCan.close();
            render();
            showToast('Vaga cancelada.', 'success');
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
        } finally {
            botao.disabled = false;
        }
    });

    // Fechar pelos botões "Voltar"/"Manter vaga"/X e devolver o foco a quem abriu
    document.addEventListener('click', (ev) => {
        const b = ev.target.closest('.pp-dlg [data-fechar]');
        if (b) b.closest('dialog').close();
    });
    [dlgFin, dlgCan, dlgDet].forEach((d) =>
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
    // Editar vaga (PATCH /monitorias/:id). Dia e horário só mudam até 24h antes; local, lugares
    // e assunto, até o início. Lugares nunca abaixo do número de inscritos. Se dia, horário ou
    // local mudarem, os inscritos podem cancelar sem a regra das 24h (o e-mail vem no plano 3).
    const dlgEd = document.getElementById('dlg-editar');
    const edForm = document.getElementById('ed-form');
    const ed = (id) => document.getElementById('ed-' + id);
    const isoDia = (d) =>
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
    function botaoEditar(v, classe) {
        return (
            '<button type="button" class="' +
            (classe || 'pp-btn pp-btn-sec') +
            '" data-acao="editar" data-id="' +
            esc(v.id) +
            '">Editar</button>'
        );
    }
    // --- Horário: lista curta (combobox/listbox do WAI-ARIA), como em "Abrir nova vaga" ---
    // Mesmos horários da criação (MarcarDatas.horarios): das 07:00 às 22:00, de 15 em 15 min.
    // O horário atual da vaga entra na lista mesmo fora desse passo.
    const HORA_INICIO = 7 * 60;
    const HORA_FIM = 22 * 60;
    const HORA_PASSO = 15;
    const horaBtn = ed('hora');
    const horaLista = document.getElementById('ed-hora-lista');
    const horaItens = () => Array.from(horaLista.querySelectorAll('li'));
    function horariosDaLista(atual) {
        const lista = [];
        for (let m = HORA_INICIO; m <= HORA_FIM; m += HORA_PASSO)
            lista.push(
                String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
            );
        if (atual && !lista.includes(atual)) lista.push(atual);
        return lista.sort();
    }
    function definirHora(valor) {
        horaBtn.dataset.valor = valor;
        horaBtn.querySelector('.valor').textContent = valor;
        horaLista.innerHTML = horariosDaLista(valor)
            .map(
                (h) =>
                    '<li role="option" id="ed-h-' +
                    h.replace(':', '') +
                    '" data-hora="' +
                    h +
                    '" aria-selected="' +
                    (h === valor) +
                    '">' +
                    h +
                    '</li>'
            )
            .join('');
    }
    // Marca o item ativo e rola só dentro da lista, sem mexer no diálogo
    function marcarAtivo(item) {
        horaItens().forEach((x) => x.classList.toggle('ativo', x === item));
        if (!item) return;
        horaLista.setAttribute('aria-activedescendant', item.id);
        const topo = item.offsetTop;
        const fim = topo + item.offsetHeight;
        if (topo < horaLista.scrollTop) horaLista.scrollTop = topo - 4;
        else if (fim > horaLista.scrollTop + horaLista.clientHeight)
            horaLista.scrollTop = fim - horaLista.clientHeight + 4;
    }
    function abrirHora() {
        if (horaBtn.disabled) return;
        horaLista.hidden = false;
        horaBtn.setAttribute('aria-expanded', 'true');
        const itens = horaItens();
        const inicial = itens.find((x) => x.getAttribute('aria-selected') === 'true') || itens[0];
        horaLista.scrollTop = Math.max(
            inicial.offsetTop - horaLista.clientHeight / 2 + inicial.offsetHeight / 2,
            0
        );
        marcarAtivo(inicial);
        horaLista.focus({ preventScroll: true });
    }
    function fecharHora(devolverFoco) {
        if (horaLista.hidden) return;
        horaLista.hidden = true;
        horaBtn.setAttribute('aria-expanded', 'false');
        horaLista.removeAttribute('aria-activedescendant');
        if (devolverFoco) horaBtn.focus();
    }
    function escolherHora(item) {
        if (!item) return;
        definirHora(item.dataset.hora);
        horaBtn.removeAttribute('aria-invalid');
        fecharHora(true);
        edAtualizarAviso();
    }
    horaBtn.addEventListener('click', () => (horaLista.hidden ? abrirHora() : fecharHora(true)));
    horaBtn.addEventListener('keydown', (ev) => {
        if (['ArrowDown', 'ArrowUp'].includes(ev.key)) {
            ev.preventDefault();
            abrirHora();
        }
    });
    horaLista.addEventListener('click', (ev) => escolherHora(ev.target.closest('li')));
    horaLista.addEventListener('keydown', (ev) => {
        const itens = horaItens();
        const atual = horaLista.querySelector('li.ativo');
        const mover = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 }[ev.key];
        if (mover) {
            ev.preventDefault();
            marcarAtivo(
                itens[Math.min(Math.max(itens.indexOf(atual) + mover, 0), itens.length - 1)]
            );
        } else if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            marcarAtivo(itens[ev.key === 'Home' ? 0 : itens.length - 1]);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            escolherHora(atual);
        } else if (ev.key === 'Escape') {
            // Esc fecha só a lista, não o diálogo
            ev.preventDefault();
            ev.stopPropagation();
            fecharHora(true);
        } else if (ev.key === 'Tab') {
            fecharHora(false);
        }
    });
    // Clicar fora da lista (dentro do diálogo) fecha a lista
    dlgEd.addEventListener('pointerdown', (ev) => {
        if (!ev.target.closest('.pp-hora')) fecharHora(false);
    });
    dlgEd.addEventListener('close', () => fecharHora(false));

    // Dia: o campo inteiro abre o calendário, e não só o ícone
    ed('data').addEventListener('click', () => {
        try {
            ed('data').showPicker();
        } catch {
            // Navegador sem showPicker ou campo bloqueado: fica o comportamento nativo
        }
    });

    function edMudancas(v) {
        const novo = new Date(ed('data').value + 'T' + horaBtn.dataset.valor);
        return {
            novo,
            // Por minuto: os segundos do horário gravado não contam como mudança
            quando: !isNaN(novo) && Math.floor(novo / 60000) !== Math.floor(v.inicio / 60000),
            local: ed('local').value.trim() !== v.local
        };
    }
    function edAtualizarAviso() {
        const v = S.alvo;
        const m = edMudancas(v);
        const aviso = ed('aviso');
        if ((m.quando || m.local) && v.inscritos)
            aviso.textContent =
                (v.inscritos === 1
                    ? 'O aluno inscrito vê a mudança no perfil e pode'
                    : 'Os ' + v.inscritos + ' alunos inscritos veem a mudança no perfil e podem') +
                ' cancelar sem a regra das 24h.';
        else if (m.quando || m.local) aviso.textContent = 'Ninguém se inscreveu ainda.';
        aviso.hidden = !(m.quando || m.local);
    }
    function abrirEditar(v) {
        S.alvo = v;
        const perto = v.inicio - S.agora < D.HORAS_CANCELAMENTO * 3600e3;
        ed('sub').textContent =
            v.disciplina + ' · ' + D.diaCurto(v.inicio) + ' às ' + D.hora(v.inicio);
        ed('data').value = isoDia(v.inicio);
        ed('data').min = isoDia(new Date());
        definirHora(D.hora(v.inicio));
        ed('data').disabled = horaBtn.disabled = perto;
        ed('nota-24h').hidden = !perto;
        ed('local').value = v.local;
        ed('cap').value = v.capacidade;
        ed('cap').min = Math.max(1, v.inscritos || 0);
        ed('cap-dica').textContent = v.inscritos
            ? 'Mínimo ' +
              v.inscritos +
              ': já há ' +
              D.plural(v.inscritos, 'inscrito', 'inscritos') +
              '.'
            : 'Ninguém inscrito ainda.';
        ed('desc').value = v.descricao || '';
        ed('erro').textContent = '';
        edForm.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
        edAtualizarAviso();
        dlgEd.showModal();
    }
    edForm.addEventListener('input', edAtualizarAviso);
    edForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = S.alvo;
        const m = edMudancas(v);
        const cap = Number(ed('cap').value);
        const erro = (campo, texto) => {
            ed('erro').textContent = texto;
            ed(campo).setAttribute('aria-invalid', 'true');
            ed(campo).focus();
        };
        edForm.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
        if (m.quando && m.novo <= new Date())
            return erro('hora', 'Escolha um dia e horário que ainda não passaram.');
        if (!ed('local').value.trim()) return erro('local', 'Informe onde a monitoria acontece.');
        if (!Number.isInteger(cap) || cap < Math.max(1, v.inscritos || 0))
            return erro(
                'cap',
                'Lugares não pode ficar abaixo de ' + Math.max(1, v.inscritos || 0) + '.'
            );
        const btn = ed('salvar');
        btn.disabled = true;
        btn.textContent = 'Salvando…';
        const r = await chamadaApi('/monitorias/' + v.id, {
            method: 'PATCH',
            body: JSON.stringify(
                Object.assign(m.quando ? { horario: m.novo.toISOString() } : {}, {
                    local: ed('local').value.trim(),
                    capacidade: cap,
                    descricao: ed('desc').value.trim()
                })
            )
        });
        btn.disabled = false;
        btn.textContent = 'Salvar alterações';
        if (!r.success)
            return (ed('erro').textContent = mensagemDaApi(r, 'Não foi possível salvar a vaga.'));
        if (m.quando) v.inicio = m.novo;
        v.local = ed('local').value.trim();
        v.capacidade = cap;
        v.descricao = ed('desc').value.trim();
        dlgEd.close();
        showToast(
            r.liberados
                ? 'Vaga atualizada. Os inscritos podem cancelar sem a regra das 24h.'
                : 'Vaga atualizada.',
            'success'
        );
        render();
    });
    dlgEd.querySelector('[data-fechar]').addEventListener('click', () => dlgEd.close());

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
        if (acao === 'mais') return carregarMais();
        if (acao === 'presenca') return confirmarPresenca(b);
        const vaga = vagaPorId(b.dataset.id);
        if (!vaga) return;
        const deDentro = b.closest('dialog');
        if (deDentro) deDentro.close();
        else S.gatilho = b;
        if (acao === 'detalhes') abrirDetalhes(vaga);
        else if (acao === 'finalizar') abrirFinalizar(vaga);
        else if (acao === 'cancelar') abrirCancelar(vaga);
        else if (acao === 'editar') abrirEditar(vaga);
    }
    raiz.addEventListener('click', aoAgir);
    dlgDet.addEventListener('click', aoAgir);

    // Abas do computador pelo teclado (setas, Home, End)
    raiz.addEventListener('keydown', (ev) => {
        if (!ev.target.closest('.pp-abas')) return;
        const ordem = ['finalizar', 'proximas', 'historico'];
        let i = ordem.indexOf(S.aba);
        if (ev.key === 'ArrowRight') i = (i + 1) % 3;
        else if (ev.key === 'ArrowLeft') i = (i + 2) % 3;
        else if (ev.key === 'Home') i = 0;
        else if (ev.key === 'End') i = 2;
        else return;
        ev.preventDefault();
        trocarAba(ordem[i]);
    });

    carregar();
});
