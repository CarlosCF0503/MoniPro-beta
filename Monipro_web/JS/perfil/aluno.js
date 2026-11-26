// JS/perfil/aluno.js
// Perfil do aluno, com a mesma montagem do perfil do monitor (JS/perfil/monitor.js):
// - >= 700px (opção A): dados e pontos numa coluna lateral; monitorias em três abas
//   (Para confirmar, Próximas, Histórico) com contagem.
// - < 700px (opção C): abas no rodapé (Monitorias, Pontos, Perfil); Monitorias tem o filtro
//   "Em aberto / Histórico" e os detalhes abrem num painel que sobe do rodapé.
// P2 (R4): depois de cada sessão o aluno confirma a própria presença; com a confirmação do
// monitor também, ele ganha os pontos.
// Depende de: api.js (chamadaApi, mensagemDaApi, escaparHtml), toast.js, perfil/dados.js e, nesta
// pasta, comum.js (sessão e ícones), aluno_telas.js (montagem) e aluno_dialogos.js (diálogos).

import { showToast, mensagemDaApi } from '../toast.js';
import { chamadaApi, escaparHtml } from '../api.js';
import { PerfilDados } from './dados.js';
import { conferirSessaoDoPerfil, icone } from './comum.js';
import { AgendaIcs } from '../agenda.js';
import { criarTelasAluno } from './aluno_telas.js';
import { criarDialogosAluno } from './aluno_dialogos.js';

document.addEventListener('DOMContentLoaded', async () => {
    const D = PerfilDados;
    const esc = escaparHtml;
    const raiz = document.getElementById('perfil-app');
    const celularMq = window.matchMedia('(max-width: 699px)');
    const celular = () => celularMq.matches;
    if (!raiz || !D) return;

    // --- 1. Sessão (perfil/comum.js) ---
    if (!(await conferirSessaoDoPerfil(false))) return;

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

    // --- 3. Peças ---
    const listas = () => D.separarInscricoes(S.inscricoes, S.agora);
    const situacao = (i) => D.situacaoDoAluno(i, S.agora);
    const confirmadas = () => S.inscricoes.filter((i) => i.status === 'concluido').length;
    const AVISO_24H = 'Cancelamento só até ' + D.HORAS_CANCELAMENTO + 'h antes';
    const AVISO_MUDOU = 'Pode cancelar até o início';
    // Editar vaga: o que mudou desde a inscrição ("Horário alterado: era ..."). Plano 8: quem
    // saiu da lista de espera a menos de 24h também pode cancelar até o início
    const textoMudou = (i) =>
        D.mudancasDaVaga(i).join(' ') ||
        (i.promovido ? 'Você saiu da lista de espera.' : 'A vaga foi alterada.');
    const notaMudou = (i, t) =>
        i.liberado ? '<span class="nota-24h">' + icone('relogio', t) + AVISO_MUDOU + '</span>' : '';
    // Plano 8: posição na lista de espera ("2º da fila")
    const posicaoTexto = (i) => (i.posicaoFila ? i.posicaoFila + 'º da fila' : 'Na fila');
    const SITUACOES = {
        confirmar: ['pill-atencao', 'relogio', 'Confirme sua presença'],
        antes: ['pill-aberta', 'calendario', 'Inscrito'],
        aguardando: ['pill-aberta', 'relogio', 'Aguardando o monitor'],
        confirmada: ['pill-ok', 'ok', 'Presença confirmada'],
        expirada: ['pill-perigo', 'x', 'Presença não confirmada'],
        cancelada: ['pill-perigo', 'x', 'Vaga cancelada'],
        fila: ['pill-atencao', 'pessoas', 'Lista de espera'],
        ausente: ['pill-perigo', 'x', 'Falta registrada'],
        semLugar: ['pill-perigo', 'x', 'Não abriu lugar']
    };
    // Plano 7: pedido de revisão da falta (recurso) com atestado, até 30 dias depois da marcação
    const DIAS_RECURSO = 30;
    const MAX_ANEXO = 5 * 1024 * 1024;
    const TIPOS_ANEXO = ['application/pdf', 'image/jpeg', 'image/png'];
    function situacaoRecurso(i) {
        if (i.recurso && i.recurso.status === 'pendente') return 'pendente';
        if (i.recurso && i.recurso.status === 'recusado') return 'recusado';
        if (!i.ausenteEm) return 'fora';
        const limite = new Date(i.ausenteEm.getTime() + DIAS_RECURSO * 24 * 3600e3);
        return S.agora <= limite ? 'pode' : 'fora';
    }
    function limiteRecurso(i) {
        const limite = new Date(i.ausenteEm.getTime() + DIAS_RECURSO * 24 * 3600e3);
        return D.diaMes(limite);
    }
    function botaoRecurso(i) {
        return (
            '<button type="button" class="pp-btn pp-btn-sec" data-acao="recurso" data-id="' +
            esc(i.id) +
            '">' +
            icone('doc', 14) +
            'Pedir revisão da falta</button>'
        );
    }
    function notaRecurso(i) {
        const r = situacaoRecurso(i);
        if (r === 'pendente')
            return (
                '<span class="nota-24h nota-recurso">' +
                icone('relogio', 12) +
                'Revisão pedida em ' +
                esc(D.diaMes(new Date(i.recurso.criado_em))) +
                ' · em análise pela coordenação</span>'
            );
        if (r === 'recusado')
            return (
                '<span class="nota-24h nota-recurso recusado">' +
                icone('x', 12) +
                'Revisão recusada: ' +
                esc(i.recurso.motivo_decisao || 'sem motivo informado') +
                '</span>'
            );
        return '';
    }

    // Plano 6 (RF-006): avaliar a monitoria (nota de 1 a 5), com presença dos dois lados, uma vez,
    // até 7 dias depois da sessão (o mesmo prazo da confirmação)
    // Nota em número ("4/5"): mais legível no celular que uma fileira de estrelas
    const SIGNIFICADO = { 1: 'Ruim', 2: 'Fraca', 3: 'Ok', 4: 'Boa', 5: 'Ótima' };
    function podeAvaliar(i) {
        return !i.avaliacao && S.agora <= D.limiteConfirmacao({ inicio: i.inicio });
    }
    const botaoAvaliar = (i, classe, rotulo) =>
        '<button type="button" class="' +
        classe +
        '" data-acao="avaliar" data-id="' +
        esc(i.id) +
        '" aria-label="Avaliar a monitoria de ' +
        esc(i.disciplina) +
        '">' +
        rotulo +
        '</button>';
    function avaliacaoHTML(i) {
        if (i.avaliacao)
            return (
                '<span class="nota-chip" title="Sua avaliação">Sua nota ' +
                i.avaliacao.nota +
                '/5</span>'
            );
        if (podeAvaliar(i)) return botaoAvaliar(i, 'pp-btn pp-btn-sec', 'Avaliar monitoria');
        return '';
    }
    // Celular: monitorias com presença confirmada que ainda dá para avaliar
    const paraAvaliar = (L) =>
        L.historico.filter((i) => situacao(i) === 'confirmada' && podeAvaliar(i));

    function etiqueta(i) {
        const sit = situacao(i);
        const [classe, ico, texto] = SITUACOES[sit];
        const rotulo = sit === 'fila' ? texto + ' · ' + posicaoTexto(i) : texto;
        return '<span class="pill ' + classe + '">' + icone(ico, 12) + rotulo + '</span>';
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
        if (sit === 'ausente') {
            const lim = D.limiteConfirmacao({ inicio: i.inicio });
            return S.agora <= lim
                ? 'O monitor registrou falta. Se foi engano, fale com ele: dá para corrigir até ' +
                      D.diaMes(lim) +
                      ' às ' +
                      D.hora(lim) +
                      '.' +
                      (situacaoRecurso(i) === 'pode'
                          ? ' Se você faltou por um motivo justificado, peça a revisão à coordenação com o atestado.'
                          : '')
                : situacaoRecurso(i) === 'pode'
                  ? 'O monitor registrou falta. Se foi por um motivo justificado, peça a revisão à coordenação com o atestado até ' +
                    limiteRecurso(i) +
                    '.'
                  : 'O monitor registrou falta nesta monitoria.';
        }
        if (sit === 'fila')
            return (
                'Se abrir um lugar até ' +
                D.HORAS_FILA +
                'h antes do início, você é inscrito na hora e recebe um e-mail.'
            );
        if (sit === 'antes' && i.promovido) return 'Você entrou pela lista de espera.';
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
            '">' +
            (i.naFila ? 'Sair da fila' : 'Cancelar inscrição') +
            '</button>'
        );
    }
    // Plano 11: link da sala on-line, aberto em outra aba. Em destaque perto do horário.
    function botaoSala(i) {
        if (!i.link) return '';
        const aberta = D.salaAberta(i, S.agora);
        return (
            '<a class="pp-btn ' +
            (aberta ? 'pp-btn-pri' : 'pp-btn-sec') +
            ' pp-btn-sala" href="' +
            esc(i.link) +
            '" target="_blank" rel="noopener noreferrer">' +
            icone('video', 16) +
            'Entrar na sala</a>'
        );
    }
    // Plano 10 (RF-015): baixa o .ics da inscrição para a agenda do aparelho
    function botaoAgenda(i) {
        return (
            '<button type="button" class="pp-btn pp-btn-sec pp-btn-agenda" data-acao="agenda" data-id="' +
            esc(i.id) +
            '" aria-label="Adicionar ' +
            esc(i.disciplina) +
            ' à agenda">' +
            icone('calendario', 16) +
            'Adicionar à agenda</button>'
        );
    }
    function adicionarAgenda(i) {
        try {
            AgendaIcs.baixar(AgendaIcs.eventoDaInscricao(i, window.location.origin));
            showToast('Arquivo baixado. Abra-o para colocar a monitoria na sua agenda.', 'success');
        } catch (erro) {
            showToast('Não foi possível gerar o arquivo da agenda.', 'error', erro);
        }
    }
    // Local na linha: "On-line" no lugar do endereço
    function localHTML(i) {
        return i.online ? icone('video') + 'On-line' : icone('local') + esc(i.local);
    }
    function acoes(i) {
        const sit = situacao(i);
        if (sit === 'confirmar')
            return '<div class="vg-acoes">' + botaoConfirmar(i, 'pp-btn pp-btn-pri') + '</div>';
        if (sit === 'fila') return '<div class="vg-acoes">' + botaoCancelar(i) + '</div>';
        if (sit === 'confirmada' && avaliacaoHTML(i))
            return '<div class="vg-acoes">' + avaliacaoHTML(i) + '</div>';
        if (sit === 'ausente')
            return (
                '<div class="vg-acoes">' +
                (situacaoRecurso(i) === 'pode' ? botaoRecurso(i) : notaRecurso(i)) +
                '</div>'
            );
        if (sit === 'antes')
            return (
                '<div class="vg-acoes">' +
                botaoSala(i) +
                botaoAgenda(i) +
                (D.podeCancelarInscricao(i, S.agora)
                    ? notaMudou(i, 12) + botaoCancelar(i)
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
    // Plano 5 (RF-011): extrato dos pontos (GET /pontos/extrato). Cada linha é um evento; a
    // posição na disciplina em que mais pontuou só aparece para o próprio aluno.
    const dataCurta = (iso) =>
        new Date(iso).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });
    function comoGanharHTML() {
        const como =
            '<p class="ext-como">Você ganha +' +
            D.PONTOS_ALUNO +
            ' por presença confirmada pelos dois lados, até ' +
            D.DIAS_CONFIRMACAO +
            ' dias depois da monitoria.</p>';
        const ex = S.extrato;
        if (!ex) return '<div class="pp-esqueleto" aria-hidden="true"><span></span></div>';
        if (ex.erro || !ex.eventos.length)
            return (
                '<div class="cert-vazio">' +
                icone('moeda', 22) +
                '<p><strong>Como ganhar pontos</strong>Depois de cada monitoria, confirme a sua presença aqui. Quando o monitor também confirmar, você ganha +' +
                D.PONTOS_ALUNO +
                ' pontos. O prazo é de ' +
                D.DIAS_CONFIRMACAO +
                ' dias.</p></div>' +
                '<a class="ext-link" href="ranking.html">Ver ranking de monitores</a>'
            );
        const linhas = ex.eventos
            .map((e) => {
                let classe = ' zero';
                if (e.pontos > 0) classe = '';
                else if (e.pontos < 0) classe = ' neg';
                return (
                    '<li><span class="t">' +
                    esc(e.texto) +
                    '</span><span class="p' +
                    classe +
                    '">' +
                    (e.pontos > 0 ? '+' : '') +
                    esc(e.pontos) +
                    '</span><small>' +
                    esc(e.disciplina ? e.disciplina + ' · ' : '') +
                    esc(dataCurta(e.data)) +
                    '</small></li>'
                );
            })
            .join('');
        return (
            '<div class="ext">' +
            (ex.posicao
                ? '<p class="ext-pos">Em <b>' +
                  esc(ex.posicao.disciplina) +
                  '</b>, você está em <b>' +
                  esc(ex.posicao.lugar) +
                  'º</b> de ' +
                  esc(ex.posicao.total) +
                  (ex.posicao.total === 1 ? ' aluno' : ' alunos') +
                  ' neste semestre. Só você vê a sua posição.</p>'
                : '') +
            '<ul class="ext-lista" aria-label="Extrato de pontos">' +
            linhas +
            '</ul>' +
            como +
            '<a class="ext-link" href="ranking.html">Ver ranking de monitores</a></div>'
        );
    }
    async function carregarExtrato() {
        try {
            const r = await chamadaApi('/pontos/extrato');
            S.extrato = r.success ? r : { erro: true, eventos: [] };
        } catch {
            S.extrato = { erro: true, eventos: [] };
        }
        render();
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

    // --- 4. Telas: computador (opção A) e celular (opção C), em perfil/aluno_telas.js ---
    const { telaDesktop, telaCelular } = criarTelasAluno({
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
    // Plano 12: bloqueio de novas inscrições por faltas (ou null)
    function avisoRestricao() {
        const r = S.restricao;
        if (!r) return '';
        const ate = new Date(r.ate);
        return (
            '<div class="pp-aviso-presenca pp-aviso-bloqueio" role="status">' +
            icone('x', 18) +
            '<span><b>Novas inscrições bloqueadas até ' +
            D.diaMes(ate) +
            ' às ' +
            D.hora(ate) +
            '.</b> Você faltou a ' +
            r.faltas +
            ' monitorias nos últimos 30 dias. As inscrições que você já tem continuam valendo.</span></div>'
        );
    }

    async function carregar() {
        S.carregando = true;
        S.erro = null;
        render();
        try {
            const [perfil, lista, restricao] = await Promise.all([
                chamadaApi('/perfil'),
                chamadaApi('/perfil/agendamentos?limit=' + LIMITE + '&page=1'),
                chamadaApi('/perfil/restricao').catch(() => null)
            ]);
            S.restricao = (restricao && restricao.success && restricao.restricao) || null;
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
        // O extrato vem à parte: se falhar, o resto do perfil continua funcionando
        carregarExtrato();
    }

    // --- 7. Diálogos ---
    const dlgCan = document.getElementById('dlg-cancelar');
    const dlgDet = document.getElementById('dlg-detalhes');
    const inscricaoPorId = (id) => S.inscricoes.find((i) => String(i.id) === String(id));

    const { abrirDetalhes, confirmarPresenca, abrirCancelar, abrirRecurso, abrirAvaliar } =
        criarDialogosAluno({
            raiz,
            S,
            situacao,
            AVISO_24H,
            textoMudou,
            MAX_ANEXO,
            TIPOS_ANEXO,
            situacaoRecurso,
            botaoRecurso,
            notaRecurso,
            SIGNIFICADO,
            avaliacaoHTML,
            etiqueta,
            quando,
            notaPresenca,
            botaoConfirmar,
            botaoCancelar,
            botaoSala,
            botaoAgenda,
            carregarExtrato,
            render,
            sessaoExpirada,
            carregar,
            dlgCan,
            dlgDet,
            inscricaoPorId
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
        if (acao === 'presenca') return confirmarPresenca(b);
        const i = inscricaoPorId(b.dataset.id);
        if (!i) return;
        if (acao === 'agenda') return adicionarAgenda(i);
        const deDentro = b.closest('dialog');
        if (deDentro) deDentro.close();
        else S.gatilho = b;
        if (acao === 'detalhes') abrirDetalhes(i);
        else if (acao === 'cancelar') abrirCancelar(i);
        else if (acao === 'recurso') abrirRecurso(i);
        else if (acao === 'avaliar') abrirAvaliar(i);
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
