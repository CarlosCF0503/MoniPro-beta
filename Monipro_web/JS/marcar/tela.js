// JS/marcar/tela.js
// Tela de marcar monitoria (aluno) e criar vaga (monitor).
// Montagem decidida pelo time: a partir de 700px, calendário + coluna lateral; abaixo disso,
// passo a passo (aluno: Dia → Horário → Confirmar; monitor: Dia → Detalhes → Revisar).
// As duas montagens usam o mesmo estado, então mudar a largura no meio do fluxo não perde nada.
// A tela do aluno fica em marcar/tela_aluno.js e a do monitor em marcar/tela_monitor.js; aqui
// ficam a sessão, o estado, a carga das vagas e os eventos.
// Depende de: toast.js, api.js, marcar/datas.js, marcar/componentes.js.

import { showToast, mensagemDaApi } from '../toast.js';
import { chamadaApi, obterSessao, escaparHtml } from '../api.js';
import { MarcarDatas } from './datas.js';
import { MarcarComponentes } from './componentes.js';
import { ligarCampoHora } from './campo_hora.js';
import { criarTelaAluno } from './tela_aluno.js';
import { criarTelaMonitor } from './tela_monitor.js';

document.addEventListener('DOMContentLoaded', async () => {
    const D = MarcarDatas;
    const C = MarcarComponentes;
    const esc = escaparHtml;
    const raiz = document.getElementById('app');
    const largura = window.matchMedia('(min-width: 700px)');
    const desktop = () => largura.matches;

    const btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) btnVoltar.addEventListener('click', () => history.back());

    // --- 1. Parâmetros e usuário ---
    const params = new URLSearchParams(window.location.search);
    const disciplinaID = params.get('disciplinaID');
    const disciplinaNome = params.get('disciplinaNome') || 'Disciplina';

    if (!disciplinaID) {
        showToast('Informações inválidas. Redirecionando...', 'error');
        setTimeout(() => {
            window.location.href = 'base.html';
        }, 1500);
        return;
    }

    // P3 (R7): quem está logado vem de GET /auth/sessao (o token fica no cookie httpOnly)
    let usuario;
    try {
        usuario = await obterSessao();
    } catch (erro) {
        showToast(erro.message || 'Falha na comunicação com o servidor.', 'error', erro);
        return;
    }
    if (!usuario) {
        window.location.href = 'index.html';
        return;
    }
    const PERFIL = usuario.tipo === 'monitor' ? 'monitor' : 'aluno';

    document.getElementById('titulo-pagina').textContent = 'Monitoria de ' + disciplinaNome;
    document.title = 'Monitoria de ' + disciplinaNome + ' - MoniPro';
    document.getElementById('subtitulo').textContent =
        PERFIL === 'monitor'
            ? 'Crie uma vaga: dia, horário, local e lugares'
            : 'Escolha um dia e um horário';

    // --- 2. Estado ---
    const agora = new Date();
    const S = {
        carregando: true,
        erroCarga: null,
        vagas: [],
        ano: agora.getFullYear(),
        mes: agora.getMonth(),
        // aluno
        dia: null,
        vagaId: null,
        etapa: 'escolha', // escolha | revisao | sucesso
        passo: 1,
        // Plano 13: período do dia, monitor (id em texto) e só com lugar livre
        filtros: Object.assign({}, D.FILTROS_VAZIOS),
        erro: null,
        erroDefinitivo: false,
        // monitor
        form: {
            dia: null,
            hora: '',
            local: '',
            capacidade: '1',
            descricao: '',
            // Plano 11
            modalidade: 'presencial',
            link: '',
            // Plano 9: repetir toda semana até o dia `ate`
            repetir: false,
            ate: ''
        },
        serieCriada: null,
        errosApi: {},
        tocados: {},
        erroForm: null,
        m: { passo: 1, etapa: 'form' }, // etapa: form | revisao
        criada: null,
        enviando: false
    };

    // --- 3. Consultas ---
    function minhas() {
        return S.vagas.filter((v) => v.idMonitor === Number(usuario.id));
    }
    function vagasDoPerfil() {
        return PERFIL === 'monitor' ? minhas() : filtradas();
    }
    // Plano 13: o que o aluno vê no calendário e na lista
    function filtradas() {
        return D.filtrarVagas(S.vagas, S.filtros);
    }
    function minhasNoDia(k) {
        return D.vagasDoDia(minhas(), k);
    }
    function rotuloQtd(n) {
        if (PERFIL === 'monitor')
            return n ? D.plural(n, 'vaga sua', 'vagas suas') : 'nenhuma vaga sua';
        return n ? D.plural(n, 'horário', 'horários') : 'sem horários';
    }

    // --- 4. API ---
    // Busca todas as páginas (o backend limita 100 por página), para nenhuma vaga sumir.
    async function buscarVagas() {
        let pagina = 1;
        let totalPaginas;
        const todas = [];
        do {
            const r = await chamadaApi(
                '/monitorias/' + encodeURIComponent(disciplinaID) + '?limit=100&page=' + pagina
            );
            if (r.statusHttp >= 400)
                throw new Error(mensagemDaApi(r, 'Erro ao carregar monitorias.'));
            (r.monitorias || []).forEach((m) => todas.push(D.normalizarVaga(m)));
            totalPaginas = (r.paginacao && r.paginacao.totalPaginas) || 1;
            pagina++;
        } while (pagina <= totalPaginas && pagina <= 10);
        return todas;
    }

    // Inscrições do aluno, para marcar "Você já está inscrito" antes de ele tentar agendar.
    // Se falhar, a tela segue sem a marcação: o backend continua barrando a duplicidade.
    async function buscarSituacoes() {
        const situacoes = {};
        try {
            const r = await chamadaApi('/agendamentos?limit=100');
            (r.agendamentos || []).forEach((a) => {
                situacoes[a.id_monitoria] =
                    a.status === 'cancelado'
                        ? 'cancelado'
                        : a.status === 'em_espera'
                          ? 'fila'
                          : 'inscrito';
            });
        } catch {
            /* sem marcação */
        }
        return situacoes;
    }

    async function carregar() {
        S.carregando = true;
        S.erroCarga = null;
        render();
        try {
            const [vagas, situacoes, restricao] = await Promise.all([
                buscarVagas(),
                PERFIL === 'aluno' ? buscarSituacoes() : Promise.resolve({}),
                // Plano 12: bloqueio por faltas; se a consulta falhar, o backend ainda barra
                PERFIL === 'aluno'
                    ? chamadaApi('/perfil/restricao').catch(() => null)
                    : Promise.resolve(null)
            ]);
            S.restricao = (restricao && restricao.success && restricao.restricao) || null;
            S.vagas = D.vagasFuturas(vagas, new Date());
            S.vagas.forEach((v) => {
                if (situacoes[v.id]) v.situacao = situacoes[v.id];
            });
            // Aluno: se o mês atual não tem horários, abre no mês do próximo horário
            if (PERFIL === 'aluno' && S.vagas.length) {
                const temNoMes = S.vagas.some(
                    (v) => v.inicio.getMonth() === S.mes && v.inicio.getFullYear() === S.ano
                );
                if (!temNoMes) {
                    S.ano = S.vagas[0].inicio.getFullYear();
                    S.mes = S.vagas[0].inicio.getMonth();
                }
            }
        } catch (erro) {
            S.erroCarga = erro.message || 'Não foi possível carregar as monitorias.';
            showToast(S.erroCarga, 'error', erro);
        }
        S.carregando = false;
        render();
    }

    // Plano 12: busca de novo o bloqueio (depois de um 423) e redesenha a tela
    async function carregarRestricao() {
        try {
            const r = await chamadaApi('/perfil/restricao');
            S.restricao = (r && r.success && r.restricao) || null;
        } catch {
            /* o erro da inscrição já está na tela */
        }
        render();
    }

    // Plano 8: POST /monitorias/:id/espera numa vaga lotada
    async function entrarNaFila(vaga) {
        S.enviando = true;
        S.erro = null;
        render();
        try {
            const r = await chamadaApi('/monitorias/' + vaga.id + '/espera', { method: 'POST' });
            if (r.success) {
                vaga.situacao = 'fila';
                vaga.naFila += 1;
                S.posicao = r.posicao;
                S.etapa = 'sucesso';
                showToast('Você entrou na lista de espera.', 'success');
            } else {
                S.erro = mensagemDaApi(r, 'Não foi possível entrar na lista de espera.');
                S.erroDefinitivo = r.statusHttp >= 400 && r.statusHttp < 500;
                if (r.statusHttp === 423) carregarRestricao();
                if (/cheia/i.test(S.erro)) vaga.filaCheia = true;
                if (/lista de espera desta vaga\./i.test(S.erro)) vaga.situacao = 'fila';
                // Abriu um lugar enquanto o aluno decidia: a inscrição normal volta a valer
                if (r.statusHttp === 422 && /lugar livre/i.test(S.erro)) {
                    vaga.livres = Math.max(vaga.livres, 1);
                    S.erroDefinitivo = false;
                }
                console.warn('[MoniPro] Lista de espera recusada:', r);
            }
        } catch (erro) {
            S.erro = 'Não foi possível conectar ao servidor. Verifique a conexão e tente de novo.';
            S.erroDefinitivo = false;
            console.error('[MoniPro]', erro);
        }
        S.enviando = false;
        render();
        focar(S.etapa === 'sucesso' ? 'sucesso' : 'revisao');
    }

    async function agendar() {
        const vaga = S.vagas.find((v) => v.id === S.vagaId);
        if (!vaga || S.enviando) return;
        if (D.aceitaFila(vaga)) return entrarNaFila(vaga);
        S.enviando = true;
        S.erro = null;
        render();
        try {
            // Tarefa 31: só id_monitoria; o backend grava o horário da própria vaga
            const r = await chamadaApi('/agendamentos', {
                method: 'POST',
                body: JSON.stringify({ id_monitoria: vaga.id })
            });
            if (r.success) {
                vaga.livres = Math.max(vaga.livres - 1, 0);
                vaga.situacao = 'inscrito';
                S.etapa = 'sucesso';
                showToast('Monitoria agendada com sucesso!', 'success');
            } else {
                S.erro = mensagemDaApi(r, 'Não foi possível agendar.');
                // 4xx: a vaga mudou (lotou, já inscrito, fechou); tentar de novo não resolve
                S.erroDefinitivo = r.statusHttp >= 400 && r.statusHttp < 500;
                // Plano 12: bloqueado por faltas (423)
                if (r.statusHttp === 423) carregarRestricao();
                if (r.statusHttp === 409) vaga.livres = 0;
                // Plano 8: lotou enquanto o aluno decidia; a revisão passa a oferecer a fila
                if (r.statusHttp === 409 && /lotada/i.test(S.erro) && !vaga.filaCheia) {
                    S.erro =
                        'A vaga lotou enquanto você decidia. Você pode entrar na lista de espera.';
                    S.erroDefinitivo = false;
                }
                if (/inscrit/i.test(S.erro)) vaga.situacao = 'inscrito';
                console.warn('[MoniPro] Agendamento recusado:', r);
            }
        } catch (erro) {
            S.erro = 'Não foi possível conectar ao servidor. Verifique a conexão e tente de novo.';
            S.erroDefinitivo = false;
            console.error('[MoniPro]', erro);
        }
        S.enviando = false;
        render();
        focar(S.etapa === 'sucesso' ? 'sucesso' : 'revisao');
    }

    const CAMPOS_API = {
        horario: 'hora',
        local: 'local',
        descricao: 'descricao',
        capacidade: 'capacidade',
        link: 'link',
        'repeticao.ate': 'ate'
    };

    async function criarVaga() {
        const data = D.dataDoFormulario(S.form.dia, S.form.hora);
        if (!data || S.enviando) return;
        S.enviando = true;
        S.erroForm = null;
        render();
        try {
            const r = await chamadaApi('/monitorias', {
                method: 'POST',
                body: JSON.stringify({
                    id_disciplina: Number(disciplinaID),
                    horario: data.toISOString(),
                    descricao: S.form.descricao.trim(),
                    capacidade: Number(S.form.capacidade),
                    // Plano 11: on-line manda o link; a API grava o local "On-line"
                    ...(S.form.modalidade === 'online'
                        ? { modalidade: 'online', link: S.form.link.trim() }
                        : { local: S.form.local.trim() }),
                    // Plano 9: série semanal
                    ...(S.form.repetir
                        ? { repeticao: { frequencia: 'semanal', ate: S.form.ate } }
                        : {})
                })
            });
            if (r.success && r.monitoria) {
                const novas = (r.criadas || [r.monitoria]).map((m) =>
                    D.normalizarVaga({
                        ...m,
                        vagas_disponiveis: m.capacidade,
                        monitor: { nome_completo: usuario.nome }
                    })
                );
                S.vagas.push(...novas);
                S.vagas.sort((a, b) => a.inicio - b.inicio);
                S.criada = novas[0];
                S.serieCriada = r.criadas
                    ? { vagas: novas, puladas: (r.puladas || []).map((p) => new Date(p)) }
                    : null;
                showToast(
                    novas.length > 1
                        ? novas.length + ' vagas de monitoria criadas com sucesso!'
                        : 'Vaga de monitoria criada com sucesso!',
                    'success'
                );
            } else {
                // Erro de validação volta para o formulário, junto do campo
                S.errosApi = {};
                Object.entries(r.campos || {}).forEach(([campo, msg]) => {
                    if (CAMPOS_API[campo]) S.errosApi[CAMPOS_API[campo]] = msg;
                });
                S.erroForm = mensagemDaApi(r, 'Não foi possível criar a vaga.');
                S.m.etapa = 'form';
                S.m.passo = 2;
                console.warn('[MoniPro] Vaga recusada:', r);
            }
        } catch (erro) {
            S.erroForm =
                'Não foi possível conectar ao servidor. Verifique a conexão e tente de novo.';
            console.error('[MoniPro]', erro);
        }
        S.enviando = false;
        render();
        focar(S.criada ? 'sucesso' : S.m.etapa === 'revisao' ? 'revisao-vaga' : 'erro-form');
    }

    // --- 5. Partes comuns ---
    function calendario(selecionado) {
        const doPerfil = vagasDoPerfil();
        const contagem = D.contarPorDia(doPerfil);
        const noMes = doPerfil.filter(
            (v) => v.inicio.getMonth() === S.mes && v.inicio.getFullYear() === S.ano
        );
        const diasNoMes = new Set(noMes.map((v) => D.chave(v.inicio))).size;
        let resumo;
        if (!noMes.length) {
            if (PERFIL === 'monitor') resumo = 'Nenhuma vaga sua neste mês';
            else
                resumo = D.filtrosAtivos(S.filtros)
                    ? 'Nenhum horário com esses filtros neste mês'
                    : 'Nenhum horário neste mês';
        } else
            resumo =
                '<b>' +
                noMes.length +
                '</b> ' +
                (PERFIL === 'monitor'
                    ? noMes.length === 1
                        ? 'vaga sua'
                        : 'vagas suas'
                    : noMes.length === 1
                      ? 'horário'
                      : 'horários') +
                ' em <b>' +
                diasNoMes +
                '</b> ' +
                (diasNoMes === 1 ? 'dia' : 'dias');
        return C.calendario({
            ano: S.ano,
            mes: S.mes,
            agora: new Date(),
            selecionado,
            contagem,
            aceitaDiaVazio: PERFIL === 'monitor',
            rotuloQtd,
            legenda: PERFIL === 'monitor' ? 'Com vagas suas' : 'Com horários',
            resumo
        });
    }

    function erroCarga() {
        return (
            '<div class="vazio" role="alert"><p>' +
            esc(S.erroCarga) +
            '</p><button type="button" class="btn sec" data-acao="recarregar">Tentar de novo</button></div>'
        );
    }

    const { telaAluno } = criarTelaAluno({
        desktop,
        disciplinaNome,
        S,
        filtradas,
        calendario,
        erroCarga
    });

    const { errosForm, errosVisiveis, previa, DICAS, resumoSerie, telaMonitor } = criarTelaMonitor({
        desktop,
        disciplinaNome,
        usuario,
        S,
        minhas,
        minhasNoDia,
        calendario,
        erroCarga
    });

    // --- 8. Render e eventos ---
    function render() {
        raiz.innerHTML = PERFIL === 'monitor' ? telaMonitor() : telaAluno();
    }

    function focar(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Digitar no formulário atualiza só dicas, prévia e botão (re-render tiraria o foco do campo)
    function atualizarFormulario() {
        const e = errosVisiveis();
        ['hora', 'capacidade', 'local', 'link', 'ate', 'descricao'].forEach((id) => {
            const bloco = raiz.querySelector('[data-campo="' + id + '"]');
            if (!bloco) return;
            bloco.classList.toggle('err', Boolean(e[id]));
            const controle = bloco.querySelector('input, textarea');
            if (e[id]) controle.setAttribute('aria-invalid', 'true');
            else controle.removeAttribute('aria-invalid');
            bloco.querySelector('.dica').textContent =
                e[id] ||
                (id === 'descricao'
                    ? S.form.descricao.length + '/' + D.LIMITE_DESCRICAO
                    : id === 'ate'
                      ? 'No máximo ' + D.MAX_OCORRENCIAS + ' vagas'
                      : DICAS[id]);
        });
        const resumo = document.getElementById('serie-resumo');
        if (resumo) resumo.innerHTML = resumoSerie();
        const caixa = document.getElementById('previa');
        if (caixa) caixa.innerHTML = previa();
        const botao = document.getElementById('btn-revisar-vaga');
        if (botao) botao.disabled = Object.keys(errosForm()).length > 0;
    }

    raiz.addEventListener('click', (ev) => {
        const alvo = ev.target.closest('[data-acao]');
        if (!alvo || alvo.disabled) return;
        const acao = alvo.dataset.acao;
        // Seleção anterior, para animar a troca depois do render
        const diaAntes = PERFIL === 'monitor' ? S.form.dia : S.dia;
        const vagaAntes = S.vagaId;
        switch (acao) {
            case 'mes': {
                const v = D.mesVizinho(S.ano, S.mes, Number(alvo.dataset.delta));
                S.ano = v.ano;
                S.mes = v.mes;
                break;
            }
            case 'dia':
                if (PERFIL === 'monitor') {
                    S.form.dia = alvo.dataset.dia;
                    S.errosApi = {};
                    S.erroForm = null;
                    S.m.etapa = 'form';
                    if (!desktop()) S.m.passo = 2;
                } else {
                    S.dia = alvo.dataset.dia;
                    S.vagaId = null;
                    if (!desktop()) S.passo = 2;
                }
                break;
            case 'vaga':
                S.vagaId = Number(alvo.dataset.id);
                break;
            case 'revisar':
                S.etapa = 'revisao';
                S.erro = null;
                break;
            case 'voltar':
                if (S.erroDefinitivo) S.vagaId = null;
                S.erro = null;
                S.erroDefinitivo = false;
                S.etapa = 'escolha';
                S.passo = 2;
                break;
            case 'passo':
                S.passo = Number(alvo.dataset.passo);
                break;
            case 'novo':
                S.etapa = 'escolha';
                S.vagaId = null;
                S.passo = S.dia ? 2 : 1;
                break;
            case 'confirmar':
                agendar();
                return;
            case 'm-passo':
                S.m.passo = Number(alvo.dataset.passo);
                S.m.etapa = 'form';
                break;
            case 'm-revisar':
                S.m.etapa = 'revisao';
                break;
            case 'm-editar':
                S.m.etapa = 'form';
                S.m.passo = 2;
                break;
            case 'criar':
                criarVaga();
                return;
            case 'nova-vaga':
                S.criada = null;
                S.serieCriada = null;
                S.m = { passo: 2, etapa: 'form' };
                S.tocados = {};
                break;
            case 'recarregar':
                carregar();
                return;
            case 'periodo':
                S.filtros.periodo =
                    S.filtros.periodo === alvo.dataset.valor ? '' : alvo.dataset.valor;
                aplicarFiltros('[data-acao="periodo"][data-valor="' + alvo.dataset.valor + '"]');
                return;
            case 'limpar-filtros':
                S.filtros = Object.assign({}, D.FILTROS_VAZIOS);
                aplicarFiltros('[data-acao="periodo"]');
                return;
            default:
                return;
        }
        render();
        if (acao === 'revisar') focar('revisao');
        if (acao === 'm-revisar') focar('revisao-vaga');
        if (acao === 'dia') {
            animarTroca([['.dia', 'data-dia', diaAntes, alvo.dataset.dia]]);
            if (desktop()) {
                const dia = raiz.querySelector('.dia[data-dia="' + alvo.dataset.dia + '"]');
                if (dia) dia.focus({ preventScroll: true });
            }
        }
        if (acao === 'vaga') {
            // Primeira escolha: "Agendar"/"Continuar" sai de desativado com a mesma transição
            const liberar = vagaAntes
                ? []
                : Array.from(raiz.querySelectorAll('[data-acao="revisar"]'));
            animarTroca([['.vaga', 'data-id', vagaAntes, alvo.dataset.id]], liberar);
        }
    });

    /**
     * Calendário e lista são redesenhados a cada clique, então a troca de seleção seria
     * instantânea. O item novo nasce com a aparência anterior (.entrando) e o antigo com a de
     * selecionado (.saindo); tirar as classes no quadro seguinte dispara a transição do CSS.
     * @param {Array} pares - [seletor, atributo, valorAntes, valorDepois]
     * @param {Element[]} [liberar] - botões que acabaram de sair de "desativado"
     */
    function animarTroca(pares, liberar) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const marcados = [];
        pares.forEach(([seletor, atributo, antes, depois]) => {
            const novo = raiz.querySelector(seletor + '[' + atributo + '="' + depois + '"]');
            const velho =
                antes != null && String(antes) !== String(depois)
                    ? raiz.querySelector(seletor + '[' + atributo + '="' + antes + '"]')
                    : null;
            if (novo) marcados.push([novo, 'entrando']);
            if (velho) marcados.push([velho, 'saindo']);
        });
        (liberar || []).forEach((el) => marcados.push([el, 'liberando']));
        if (!marcados.length) return;
        marcados.forEach(([el, classe]) => el.classList.add(classe));
        void raiz.offsetWidth; // fixa o estado inicial antes de animar
        const soltar = () => marcados.forEach(([el, classe]) => el.classList.remove(classe));
        // rAF não roda em aba em segundo plano; o setTimeout garante que nada fica preso no meio
        requestAnimationFrame(soltar);
        setTimeout(soltar, 32);
    }

    // Plano 13: trocar um filtro redesenha calendário e lista e devolve o foco ao controle. A
    // vaga escolhida que deixou de aparecer sai da seleção.
    function aplicarFiltros(seletorFoco) {
        if (S.vagaId && !filtradas().some((v) => v.id === S.vagaId)) S.vagaId = null;
        render();
        const el = raiz.querySelector(seletorFoco);
        if (el) el.focus({ preventScroll: true });
    }
    raiz.addEventListener('change', (ev) => {
        if (ev.target.id === 'filtro-monitor') {
            S.filtros.monitor = ev.target.value;
            aplicarFiltros('#filtro-monitor');
        } else if (ev.target.id === 'filtro-livres') {
            S.filtros.livres = ev.target.checked;
            aplicarFiltros('#filtro-livres');
        }
    });

    raiz.addEventListener('input', (ev) => {
        // Plano 9: ligar "Repetir toda semana" mostra o campo "Até" (sugere 4 semanas)
        if (ev.target.id === 'f-repetir') {
            S.form.repetir = ev.target.checked;
            if (S.form.repetir && !S.form.ate && S.form.dia)
                S.form.ate = D.somarSemanas(S.form.dia, 3);
            delete S.errosApi.ate;
            render();
            const caixa = document.getElementById('f-repetir');
            if (caixa) caixa.focus();
            return;
        }
        // Plano 11: trocar a modalidade troca o campo Local pelo Link da sala
        if (ev.target.name === 'modalidade') {
            S.form.modalidade = ev.target.value;
            delete S.errosApi.local;
            delete S.errosApi.link;
            render();
            const marcado = raiz.querySelector('input[name="modalidade"]:checked');
            if (marcado) marcado.focus();
            return;
        }
        const id = ev.target.id;
        // O horário é tratado por campo_hora.js (máscara HH:MM), em ligarCampoHora abaixo
        if (!id || id.indexOf('f-') !== 0 || id === 'f-hora') return;
        const nome = id.slice(2);
        S.form[nome] = ev.target.value;
        S.tocados[nome] = true;
        delete S.errosApi[nome];
        atualizarFormulario();
    });

    // Sair de um campo vazio obrigatório também conta como "usado" e mostra o erro
    raiz.addEventListener('focusout', (ev) => {
        const id = ev.target.id;
        if (!id || id.indexOf('f-') !== 0 || id === 'f-hora') return;
        S.tocados[id.slice(2)] = true;
        atualizarFormulario();
    });

    // --- Horário: digitado (HH:MM, qualquer minuto) ou escolhido na lista de sugestões ---
    // O erro aparece quando o horário fica completo (ex.: 14:43) ou ao sair do campo, não a cada tecla.
    ligarCampoHora(raiz, (_input, valor, final) => {
        S.form.hora = valor;
        if (final || D.horaValida(valor)) S.tocados.hora = true;
        delete S.errosApi.hora;
        atualizarFormulario();
    });

    // Calendário pelo teclado: setas mudam o dia, Home/End vão ao início/fim da semana
    raiz.addEventListener('keydown', (ev) => {
        const botao = ev.target.closest('.dia');
        if (!botao) return;
        const data = D.deChave(botao.dataset.dia);
        if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            const inicio = ev.key === 'Home';
            data.setDate(data.getDate() + (inicio ? -data.getDay() : 6 - data.getDay()));
            moverFoco(data, inicio ? 1 : -1);
            return;
        }
        const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
        if (!passo) return;
        ev.preventDefault();
        for (let i = 0; i < 62; i++) {
            data.setDate(data.getDate() + passo);
            if (moverFoco(data, 0)) return;
            if (passo < 0 && D.diaPassado(data, new Date())) return;
        }
    });

    function moverFoco(data, ajuste) {
        if (data.getMonth() !== S.mes || data.getFullYear() !== S.ano) {
            S.ano = data.getFullYear();
            S.mes = data.getMonth();
            render();
        }
        let alvo = raiz.querySelector('.dia[data-dia="' + D.chave(data) + '"]');
        for (let i = 0; i < 6 && ajuste && alvo && alvo.disabled; i++) {
            data.setDate(data.getDate() + ajuste);
            alvo = raiz.querySelector('.dia[data-dia="' + D.chave(data) + '"]');
        }
        if (!alvo || alvo.disabled) return false;
        raiz.querySelectorAll('.dia[tabindex="0"]').forEach((d) =>
            d.setAttribute('tabindex', '-1')
        );
        alvo.setAttribute('tabindex', '0');
        alvo.focus();
        return true;
    }

    // Trocar de largura no meio do fluxo mantém o progresso
    largura.addEventListener('change', () => {
        if (!desktop()) {
            S.passo = S.dia ? 2 : 1;
            S.m.passo = S.form.dia ? 2 : 1;
        }
        render();
    });

    carregar();
});
