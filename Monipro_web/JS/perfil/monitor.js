// JS/perfil/monitor.js
// Perfil do monitor. Montagem decidida pelo time:
// - >= 700px (opção A): dados e certificados numa coluna lateral; vagas em três abas
//   (Para finalizar, Próximas, Histórico) com contagem.
// - < 700px (opção C): abas no rodapé (Vagas, Horas, Perfil); Vagas tem o filtro
//   "Em aberto / Histórico" e os detalhes abrem num painel que sobe do rodapé.
// As duas montagens usam o mesmo estado, então girar o celular ou redimensionar não perde nada.
// Depende de: api.js (chamadaApi, mensagemDaApi, escaparHtml), toast.js, perfil/dados.js e, nesta
// pasta, comum.js (sessão e ícones), monitor_telas.js (montagem), monitor_detalhes.js,
// monitor_editar.js e monitor_encerrar.js (diálogos).

import { showToast, mensagemDaApi } from '../toast.js';
import { chamadaApi, escaparHtml } from '../api.js';
import { PerfilDados } from './dados.js';
import { conferirSessaoDoPerfil, icone } from './comum.js';
import { AgendaIcs } from '../agenda.js';
import { criarDialogosEncerrar } from './monitor_encerrar.js';
import { criarTelasMonitor } from './monitor_telas.js';
import { criarEditarVaga } from './monitor_editar.js';
import { criarDetalhesVaga } from './monitor_detalhes.js';

document.addEventListener('DOMContentLoaded', async () => {
    const D = PerfilDados;
    const esc = escaparHtml;
    const raiz = document.getElementById('perfil-app');
    const celularMq = window.matchMedia('(max-width: 699px)');
    const celular = () => celularMq.matches;
    if (!raiz || !D) return;

    // --- 1. Sessão (perfil/comum.js) ---
    if (!(await conferirSessaoDoPerfil(true))) return;

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
        // Certificados (PR 2): horas comprovadas do semestre, calculadas pelo backend com a
        // mesma regra da declaração (GET /certificados/elegibilidade). null = carregando
        horas: null,
        horasErro: false,
        // Certificados (PR 3): declarações emitidas (GET /certificados) e emissão em andamento
        certificados: [],
        emitindo: false,
        filtroCel: 'aberto', // celular, aba Vagas: aberto | historico
        alvo: null,
        gatilho: null,
        // P2: inscrições das vagas do monitor, por vaga (Map idVaga -> lista)
        inscricoes: new Map(),
        inscricoesErro: false
    };

    // --- 3. Pedaços comuns ---
    function listas() {
        return D.separar(S.vagas, S.agora);
    }
    function textoHoras() {
        if (S.horasErro) return '–';
        return S.horas ? D.duracao(S.horas.minutos) : '…';
    }
    const nomeDoPeriodo = (p) => {
        const [ano, semestre] = String(p || '').split('.');
        return semestre + 'º semestre de ' + ano;
    };
    // curto: na linha do celular, vaga cheia vira só "Lotada" (no computador a etiqueta já diz isso)
    // Plano 8: a vaga lotada mostra também quantos estão na lista de espera
    function textoInscritos(v, curto) {
        if (v.inscritos === null) return 'Até ' + D.plural(v.capacidade, 'aluno', 'alunos');
        const fila = v.naFila ? ' · ' + v.naFila + ' na fila' : '';
        if (curto && v.inscritos >= v.capacidade) return 'Lotada' + fila;
        return v.inscritos + ' de ' + v.capacidade + ' inscritos' + fila;
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
    // Plano 10 (RF-015): baixa o .ics da vaga para a agenda do aparelho
    function botaoAgenda(v) {
        return (
            '<button type="button" class="pp-btn pp-btn-sec pp-btn-agenda" data-acao="agenda" data-id="' +
            esc(v.id) +
            '" aria-label="Adicionar ' +
            esc(v.disciplina) +
            ' à agenda">' +
            icone('calendario', 16) +
            'Adicionar à agenda</button>'
        );
    }
    function adicionarAgenda(v) {
        try {
            AgendaIcs.baixar(AgendaIcs.eventoDaVaga(v, window.location.origin));
            showToast('Arquivo baixado. Abra-o para colocar a monitoria na sua agenda.', 'success');
        } catch (erro) {
            showToast('Não foi possível gerar o arquivo da agenda.', 'error', erro);
        }
    }
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
                botaoAgenda(v) +
                (D.podeCancelar(v, S.agora)
                    ? botaoCancelar(v)
                    : '<span class="nota-24h">' + icone('relogio', 12) + AVISO_24H + '</span>') +
                '</div>'
            );
        return '';
    }
    // Certificados (PR 2): progresso até o mínimo da declaração e o que falta para cada sessão
    // contar. A emissão entra no próximo PR do plano.
    function certificadosHTML() {
        if (S.horasErro)
            return '<p class="pp-dica">Não foi possível carregar as horas do semestre agora.</p>';
        const h = S.horas;
        if (!h) return '<div class="pp-esqueleto" aria-hidden="true"><span></span></div>';
        const pct = Math.min(100, Math.round((h.minutos / h.minimo_minutos) * 100));
        const falta = Math.max(0, h.minimo_minutos - h.minutos);
        const pend = [];
        if (h.pendentes.a_finalizar)
            pend.push(
                D.plural(h.pendentes.a_finalizar, 'vaga para finalizar', 'vagas para finalizar')
            );
        if (h.pendentes.sem_presenca)
            pend.push(
                D.plural(
                    h.pendentes.sem_presenca,
                    'finalizada sem presença confirmada',
                    'finalizadas sem presença confirmada'
                ) + ' (não conta)'
            );
        return (
            '<div class="cert-prog">' +
            '<p class="cert-titulo">Declaração do ' +
            esc(nomeDoPeriodo(h.periodo)) +
            '</p>' +
            '<div class="cert-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
            pct +
            '" aria-label="Horas para a declaração"><i style="width:' +
            pct +
            '%"></i></div>' +
            '<p class="cert-num"><b>' +
            esc(D.duracao(h.minutos)) +
            '</b> de ' +
            esc(D.duracao(h.minimo_minutos)) +
            ' para emitir' +
            (h.pode_emitir ? ' · pronta para emitir' : ' · faltam ' + esc(D.duracao(falta))) +
            '</p>' +
            (pend.length
                ? '<p class="cert-pend">' + icone('relogio', 12) + esc(pend.join(' · ')) + '</p>'
                : '') +
            botaoEmitirHTML(h) +
            '<p class="cert-como">Contam as monitorias finalizadas com pelo menos uma presença confirmada pelos dois lados, até 4h cada.</p>' +
            '</div>' +
            listaCertificadosHTML()
        );
    }
    const SITUACAO_CERT = { valido: 'Válida', substituido: 'Substituída', revogado: 'Revogada' };
    function botaoEmitirHTML(h) {
        if (!h.pode_emitir) return '';
        const jaTem = S.certificados.some(
            (c) => c.periodo === h.periodo && c.situacao === 'valido'
        );
        return (
            '<button type="button" class="pp-btn pp-btn-pri pp-btn-p cert-emitir" data-acao="emitir-certificado"' +
            (S.emitindo ? ' disabled' : '') +
            '>' +
            icone('medalha', 16) +
            (S.emitindo
                ? 'Emitindo…'
                : jaTem
                  ? 'Emitir de novo (substitui a anterior)'
                  : 'Emitir declaração') +
            '</button>'
        );
    }
    function listaCertificadosHTML() {
        if (!S.certificados.length) return '';
        return (
            '<ul class="cert-lista" aria-label="Declarações emitidas">' +
            S.certificados
                .map(
                    (c) =>
                        '<li><span class="cert-l"><b>' +
                        esc(nomeDoPeriodo(c.periodo)) +
                        '</b><small>' +
                        esc(D.duracao(c.carga_minutos)) +
                        ' · emitida em ' +
                        esc(new Date(c.emitido_em).toLocaleDateString('pt-BR')) +
                        '</small></span><span class="cert-sit ' +
                        esc(c.situacao) +
                        '">' +
                        // Plano 7: a válida que a coordenação já assinou
                        esc(
                            c.situacao === 'valido' && c.assinado_em
                                ? 'Assinada'
                                : SITUACAO_CERT[c.situacao] || c.situacao
                        ) +
                        '</span><a class="cert-abrir" href="certificado.html?c=' +
                        encodeURIComponent(c.codigo) +
                        '">Abrir</a></li>'
                )
                .join('') +
            '</ul>'
        );
    }
    // Plano 6 (RF-007): resumo das avaliações (média só com 3 ou mais; comentários sem nome)
    async function carregarAvaliacoes() {
        try {
            const r = await chamadaApi('/perfil/avaliacoes/resumo');
            S.avaliacoes = r.success ? r : null;
        } catch {
            S.avaliacoes = null;
        }
        render();
    }
    const MESES = [
        'jan',
        'fev',
        'mar',
        'abr',
        'mai',
        'jun',
        'jul',
        'ago',
        'set',
        'out',
        'nov',
        'dez'
    ];
    const mesAno = (m) => {
        const [a, mm] = String(m).split('-');
        return MESES[Number(mm) - 1] + '/' + a;
    };
    function avaliacoesHTML() {
        const a = S.avaliacoes;
        if (!a) return '<p class="aval-vazio">Não foi possível carregar as avaliações.</p>';
        if (!a.total)
            return '<p class="aval-vazio">Ainda sem avaliações. Depois de cada monitoria, os alunos com presença confirmada dão uma nota de 1 a 5.</p>';
        const media =
            a.media == null
                ? '<p class="aval-falta"><b>' +
                  D.plural(a.total, 'avaliação', 'avaliações') +
                  '</b> · a média aparece com ' +
                  a.minimo +
                  '.</p>'
                : '<div class="aval-media"><span class="n">' +
                  String(a.media.toFixed(1)).replace('.', ',') +
                  '</span><span class="de">/5 <i aria-hidden="true">★</i></span><small>' +
                  D.plural(a.total, 'avaliação', 'avaliações') +
                  '</small></div>';
        const max = Math.max(1, ...[1, 2, 3, 4, 5].map((k) => a.distribuicao[k] || 0));
        const barras =
            '<ul class="aval-dist" aria-label="Quantas avaliações em cada nota">' +
            // Decisão de 22/11: estrelas no lugar dos números, de 5 a 1 (ordem decrescente)
            [5, 4, 3, 2, 1]
                .map(
                    (k) =>
                        '<li><span class="k" aria-label="' +
                        k +
                        (k === 1 ? ' estrela' : ' estrelas') +
                        '">' +
                        '★'.repeat(k) +
                        '</span><span class="bb"><i style="width:' +
                        Math.round(((a.distribuicao[k] || 0) / max) * 100) +
                        '%"></i></span><span class="q">' +
                        (a.distribuicao[k] || 0) +
                        '</span></li>'
                )
                .join('') +
            '</ul>';
        const coment = a.comentarios.length
            ? '<ul class="aval-coment">' +
              a.comentarios
                  .map(
                      (c) =>
                          '<li><p>' +
                          esc(c.comentario) +
                          '</p><small><b>' +
                          c.nota +
                          '/5</b> · ' +
                          mesAno(c.mes) +
                          '</small></li>'
                  )
                  .join('') +
              '</ul>'
            : '';
        return (
            media +
            barras +
            coment +
            '<p class="aval-nota">Sem o nome do aluno. Não vale pontos.</p>'
        );
    }

    async function carregarCertificados() {
        try {
            const r = await chamadaApi('/certificados');
            if (r.success) S.certificados = r.certificados || [];
        } catch {
            // A lista é um extra: sem ela o cartão continua mostrando as horas
        }
        render();
    }
    async function emitirCertificado() {
        if (S.emitindo || !S.horas) return;
        S.emitindo = true;
        render();
        try {
            const r = await chamadaApi('/certificados', {
                method: 'POST',
                body: JSON.stringify({ periodo: S.horas.periodo })
            });
            if (r.statusHttp === 401) return sessaoExpirada();
            if (r.success) {
                showToast('Declaração emitida. Abra para imprimir ou salvar em PDF.', 'success');
                await carregarCertificados();
            } else {
                showToast(mensagemDaApi(r, 'Não foi possível emitir a declaração.'), 'error', r);
            }
        } catch (erro) {
            showToast('Erro de rede. Tente de novo.', 'error', erro);
        }
        S.emitindo = false;
        render();
    }
    async function carregarHoras() {
        try {
            const r = await chamadaApi('/certificados/elegibilidade');
            S.horas = r.success ? r : null;
            S.horasErro = !r.success;
        } catch {
            S.horas = null;
            S.horasErro = true;
        }
        render();
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
    // A própria posição: o ranking é por disciplina e semestre (ranking.html)
    function linkRanking() {
        return '<a class="ext-link pp-link-ranking" href="ranking.html">Ver ranking de monitores</a>';
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

    // --- 4. Telas: computador (opção A) e celular (opção C), em perfil/monitor_telas.js ---
    const { telaDesktop, telaCelular } = criarTelasMonitor({
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
    });

    // --- 5. Desenho ---
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

    // --- 6. Carga ---
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
            // As horas e as declarações vêm à parte: se falharem, as vagas continuam aparecendo
            carregarHoras();
            carregarCertificados();
            carregarAvaliacoes();
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

    // Editar vaga (perfil/monitor_editar.js): o botão aparece nas listas e nos detalhes
    const { botaoEditar, abrirEditar } = criarEditarVaga({ S, render });

    // --- 7. Diálogos ---
    const dlgFin = document.getElementById('dlg-finalizar');
    const dlgCan = document.getElementById('dlg-cancelar');
    const dlgDet = document.getElementById('dlg-detalhes');
    const vagaPorId = (id) => S.vagas.find((v) => String(v.id) === String(id));

    const { abrirDetalhes, confirmarPresenca, marcarAusencia } = criarDetalhesVaga({
        S,
        textoInscritos,
        etiqueta,
        botaoFinalizar,
        botaoCancelar,
        AVISO_24H,
        botaoAgenda,
        inscricoesDa,
        carregarHoras,
        render,
        sessaoExpirada,
        botaoEditar,
        dlgDet,
        vagaPorId
    });

    const { abrirFinalizar, abrirCancelar } = criarDialogosEncerrar({
        raiz,
        S,
        carregarHoras,
        render,
        sessaoExpirada,
        dlgFin,
        dlgCan,
        dlgDet,
        vagaPorId
    });

    // --- 8. Ações da tela ---
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
        if (acao === 'mais') return carregarMais();
        if (acao === 'presenca') return confirmarPresenca(b);
        if (acao === 'ausencia') return marcarAusencia(b);
        if (acao === 'emitir-certificado') return emitirCertificado();
        const vaga = vagaPorId(b.dataset.id);
        if (!vaga) return;
        if (acao === 'agenda') return adicionarAgenda(vaga);
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
