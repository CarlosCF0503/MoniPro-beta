// JS/marcar/tela.js
// Tela de marcar monitoria (aluno) e criar vaga (monitor).
// Montagem decidida pelo time: a partir de 700px, calendário + coluna lateral; abaixo disso,
// passo a passo (aluno: Dia → Horário → Confirmar; monitor: Dia → Detalhes → Revisar).
// As duas montagens usam o mesmo estado, então mudar a largura no meio do fluxo não perde nada.
// Depende de: toast.js, api.js, marcar/datas.js, marcar/componentes.js.

document.addEventListener('DOMContentLoaded', async () => {
    const D = window.MarcarDatas;
    const C = window.MarcarComponentes;
    // Plano 8: com menos que isso até o início, a lista de espera não anda (src/config/listaEspera.js)
    const HORAS_FILA = 2;
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

    // --- 6. Aluno ---
    // Plano 13 (RF-017): período, monitor e só com lugar livre. Calendário e lista mostram só o
    // que combina; o resumo é anunciado pelo leitor de tela.
    function barraFiltros() {
        const f = S.filtros;
        const monitores = D.monitoresDe(S.vagas);
        const periodo = D.TURNOS.map(
            ([valor, rotulo]) =>
                '<button type="button" class="f-op" data-acao="periodo" data-valor="' +
                valor +
                '" aria-pressed="' +
                (f.periodo === valor) +
                '">' +
                rotulo +
                '</button>'
        ).join('');
        const opcoes =
            '<option value="">Todos</option>' +
            monitores
                .map(
                    (m) =>
                        '<option value="' +
                        esc(m.id) +
                        '"' +
                        (String(m.id) === f.monitor ? ' selected' : '') +
                        '>' +
                        esc(m.nome) +
                        '</option>'
                )
                .join('');
        const total = D.vagasFuturas(S.vagas, new Date()).length;
        const mostradas = D.vagasFuturas(filtradas(), new Date()).length;
        const ativos = D.filtrosAtivos(f);
        return (
            '<div class="filtros" role="group" aria-labelledby="filtros-titulo">' +
            '<p class="filtros-titulo" id="filtros-titulo">' +
            C.icone('filtro', 16) +
            'Filtrar horários</p>' +
            '<div class="f-grupo" role="group" aria-label="Período do dia"><span class="f-rotulo" aria-hidden="true">Período</span><div class="f-ops">' +
            periodo +
            '</div></div>' +
            (monitores.length > 1
                ? '<label class="f-grupo"><span class="f-rotulo">Monitor</span><select id="filtro-monitor">' +
                  opcoes +
                  '</select></label>'
                : '') +
            '<label class="f-chk"><input type="checkbox" id="filtro-livres"' +
            (f.livres ? ' checked' : '') +
            '>Só com lugar livre</label>' +
            '<p class="filtros-resumo" aria-live="polite">' +
            (ativos
                ? '<span>' +
                  D.plural(mostradas, 'horário', 'horários') +
                  ' de ' +
                  total +
                  '</span><button type="button" class="f-limpar" data-acao="limpar-filtros">Limpar filtros</button>'
                : '') +
            '</p></div>'
        );
    }
    function semCombinar() {
        return (
            '<div class="vazio vazio-filtro"><p>Nenhum horário deste dia combina com os filtros.</p>' +
            '<button type="button" class="btn sec" data-acao="limpar-filtros">Limpar filtros</button></div>'
        );
    }
    function lista(semTitulo) {
        if (!S.dia) return '<p class="vazio">Selecione um dia disponível (marcado em azul).</p>';
        const vagas = D.vagasDoDia(filtradas(), S.dia);
        if (!vagas.length && D.vagasDoDia(S.vagas, S.dia).length) return semCombinar();
        if (!vagas.length)
            return '<p class="vazio">Nenhuma monitoria encontrada para este dia.</p>';
        return (
            '<div class="lista" aria-live="polite">' +
            (semTitulo
                ? ''
                : '<p class="rotulo">' +
                  esc(D.diaLongo(D.deChave(S.dia))) +
                  ' · ' +
                  D.plural(vagas.length, 'horário', 'horários') +
                  '</p>') +
            '<div class="lista-itens">' +
            vagas.map((v) => C.cardVaga(v, { selecionada: v.id === S.vagaId })).join('') +
            '</div></div>'
        );
    }

    // Plano 8: revisão da vaga lotada, para entrar na lista de espera
    function revisaoFila(v) {
        const botoes =
            S.erro && S.erroDefinitivo
                ? '<div class="linha acoes"><button type="button" class="btn" data-acao="voltar">Ver outros horários</button></div>'
                : '<div class="linha acoes"><button type="button" class="btn sec" data-acao="voltar">Trocar horário</button>' +
                  '<button type="button" class="btn" data-acao="confirmar"' +
                  (S.enviando ? ' disabled aria-busy="true"' : '') +
                  '>' +
                  (S.enviando
                      ? 'Entrando na fila…'
                      : C.icone('pessoas', 20) + 'Entrar na lista de espera') +
                  '</button></div>';
        return (
            '<section class="revisao" id="revisao" tabindex="-1" aria-labelledby="rev-titulo">' +
            '<p class="rotulo" id="rev-titulo">Vaga lotada: entre na lista de espera</p>' +
            (S.erro ? '<p class="erro" role="alert">' + esc(S.erro) + '</p>' : '') +
            '<dl>' +
            C.linhaResumo('Disciplina', 'livro', disciplinaNome) +
            C.linhaResumo('Monitor', 'pessoa', v.monitor) +
            C.linhaResumo('Dia', 'calendario', D.diaLongo(v.inicio)) +
            C.linhaResumo('Horário', 'relogio', D.hora(v.inicio)) +
            C.linhaResumo('Local', 'local', v.local || 'A definir') +
            (v.descricao ? C.linhaResumo('Assunto', 'assunto', v.descricao) : '') +
            C.linhaResumo(
                'Lista de espera',
                'pessoas',
                v.naFila
                    ? D.plural(v.naFila, 'pessoa', 'pessoas') + ' na sua frente'
                    : 'Você será o primeiro'
            ) +
            '</dl>' +
            (S.erro && S.erroDefinitivo
                ? ''
                : '<p class="aviso">Se alguém cancelar até ' +
                  HORAS_FILA +
                  'h antes do início, você é inscrito na hora e recebe um e-mail. Dá para sair da fila pelo seu perfil quando quiser.</p>') +
            botoes +
            '</section>'
        );
    }

    function revisao() {
        const v = S.vagas.find((x) => x.id === S.vagaId);
        if (!v) return '';
        if (D.aceitaFila(v)) return revisaoFila(v);
        const prazo = D.prazoCancelamento(v.inicio);
        const prazoTexto =
            prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
            ' às ' +
            D.hora(prazo);
        let botoes;
        if (S.erro && S.erroDefinitivo)
            botoes =
                '<div class="linha acoes"><button type="button" class="btn" data-acao="voltar">Ver outros horários</button></div>';
        else
            botoes =
                '<div class="linha acoes"><button type="button" class="btn sec" data-acao="voltar">Trocar horário</button>' +
                '<button type="button" class="btn" data-acao="confirmar"' +
                (S.enviando ? ' disabled aria-busy="true"' : '') +
                '>' +
                (S.enviando ? 'Agendando…' : C.icone('agendar', 20) + 'Confirmar agendamento') +
                '</button></div>';
        return (
            '<section class="revisao" id="revisao" tabindex="-1" aria-labelledby="rev-titulo">' +
            '<p class="rotulo" id="rev-titulo">Revise antes de confirmar</p>' +
            (S.erro ? '<p class="erro" role="alert">' + esc(S.erro) + '</p>' : '') +
            '<dl>' +
            C.linhaResumo('Disciplina', 'livro', disciplinaNome) +
            C.linhaResumo('Monitor', 'pessoa', v.monitor) +
            C.linhaResumo('Dia', 'calendario', D.diaLongo(v.inicio)) +
            C.linhaResumo('Horário', 'relogio', D.hora(v.inicio)) +
            C.linhaResumo('Local', 'local', v.local || 'A definir') +
            (v.descricao ? C.linhaResumo('Assunto', 'assunto', v.descricao) : '') +
            C.linhaResumo('Lugares', 'pessoas', v.livres + ' de ' + v.capacidade + ' livres') +
            '</dl>' +
            (S.erro && S.erroDefinitivo
                ? ''
                : '<p class="aviso">Você pode cancelar até ' +
                  prazoTexto +
                  ' (24h antes do horário).</p>') +
            botoes +
            '</section>'
        );
    }

    function sucessoAluno() {
        const v = S.vagas.find((x) => x.id === S.vagaId);
        if (v.situacao === 'fila')
            return (
                '<section class="sucesso" id="sucesso" tabindex="-1"><span class="ok-icone">' +
                C.icone('ok', 28, 3) +
                '</span><h2>Você está na lista de espera</h2><p>' +
                (S.posicao ? '<b>' + S.posicao + 'º da fila</b><br>' : '') +
                esc(v.monitor) +
                ' · ' +
                esc(D.diaLongo(v.inicio)) +
                ' às ' +
                D.hora(v.inicio) +
                '<br>Se abrir um lugar, você é inscrito na hora e recebe um e-mail.</p>' +
                '<div class="linha"><button type="button" class="btn sec" data-acao="novo">Ver outros horários</button>' +
                '<a class="btn" href="perfil_aluno.html">Ver no meu perfil</a></div></section>'
            );
        return (
            '<section class="sucesso" id="sucesso" tabindex="-1"><span class="ok-icone">' +
            C.icone('ok', 28, 3) +
            '</span><h2>Monitoria agendada!</h2><p>' +
            esc(v.monitor) +
            ' · ' +
            esc(D.diaLongo(v.inicio)) +
            ' às ' +
            D.hora(v.inicio) +
            '<br>' +
            esc(v.local || 'Local a definir') +
            '</p><div class="linha"><button type="button" class="btn sec" data-acao="novo">Agendar outra</button>' +
            '<a class="btn" href="perfil_aluno.html">Ver no meu perfil</a></div></section>'
        );
    }

    // Plano 12: aviso de bloqueio por faltas, no topo da tela do aluno
    function avisoBloqueio() {
        const r = S.restricao;
        if (!r) return '';
        const ate = new Date(r.ate);
        return (
            '<div class="aviso-bloqueio" role="status">' +
            C.icone('lotada', 18) +
            '<p><b>Novas inscrições bloqueadas até ' +
            ate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
            ' às ' +
            D.hora(ate) +
            '.</b> Você faltou a ' +
            r.faltas +
            ' monitorias nos últimos 30 dias. Dá para ver os horários, mas não se inscrever nem entrar na lista de espera. As inscrições que você já tem continuam valendo.</p></div>'
        );
    }

    function telaAluno() {
        if (S.carregando) return C.carregando('Carregando horários…');
        if (S.erroCarga) return erroCarga();
        if (S.restricao && S.etapa !== 'sucesso') return avisoBloqueio() + telaAlunoLivre();
        return telaAlunoLivre();
    }

    function telaAlunoLivre() {
        if (S.etapa === 'sucesso') return sucessoAluno();
        if (!S.vagas.length)
            return '<p class="vazio">Ainda não há horários de monitoria para esta disciplina.</p>';
        const selecionada = S.vagas.find((x) => x.id === S.vagaId);
        const naFila = selecionada && D.aceitaFila(selecionada);
        const botaoAgendar =
            '<button type="button" class="btn" data-acao="revisar"' +
            (S.vagaId && !S.restricao ? '' : ' disabled') +
            '>' +
            (naFila
                ? C.icone('pessoas', 20) + 'Entrar na lista de espera'
                : C.icone('agendar', 20) + 'Agendar monitoria') +
            '</button>';
        if (desktop()) {
            const direita =
                S.etapa === 'revisao'
                    ? revisao()
                    : '<h2 class="area-titulo">Monitores disponíveis</h2>' +
                      lista(false) +
                      botaoAgendar;
            return (
                (S.etapa === 'revisao' ? '' : barraFiltros()) +
                '<div class="colunas"><div class="col"><h2 class="area-titulo">Dias disponíveis</h2>' +
                calendario(S.dia) +
                '</div><div class="col col-dir">' +
                direita +
                '</div></div>'
            );
        }
        let passo = S.etapa === 'revisao' ? 3 : S.passo;
        if (passo === 2 && !S.dia) passo = 1;
        let h = '<div class="colunas">' + C.passos(['Dia', 'Horário', 'Confirmar'], passo);
        if (passo === 1) h += barraFiltros() + calendario(S.dia);
        else if (passo === 2)
            h +=
                C.diaSelecionado(S.dia, 'passo') +
                lista(true) +
                '<div class="linha acoes"><button type="button" class="btn sec" data-acao="passo" data-passo="1">Voltar</button>' +
                '<button type="button" class="btn" data-acao="revisar"' +
                (S.vagaId && !S.restricao ? '' : ' disabled') +
                '>Continuar</button></div>';
        else h += revisao();
        return h + '</div>';
    }

    // --- 7. Monitor ---
    function errosForm() {
        return { ...D.validarVaga(S.form, new Date(), minhasNoDia(S.form.dia)), ...S.errosApi };
    }

    // Erro só aparece no campo depois que ele foi usado (ou quando veio da API); o botão
    // "Revisar vaga" continua desativado enquanto qualquer campo for inválido.
    function errosVisiveis() {
        const todos = errosForm();
        const visiveis = {};
        Object.keys(todos).forEach((campo) => {
            if (S.tocados[campo] || S.errosApi[campo]) visiveis[campo] = todos[campo];
        });
        return visiveis;
    }

    function vagaDoForm() {
        const inicio = D.dataDoFormulario(S.form.dia, S.form.hora);
        if (!inicio) return null;
        const capacidade = Math.max(Math.floor(Number(S.form.capacidade)) || 1, 1);
        const online = S.form.modalidade === 'online';
        return {
            inicio,
            monitor: usuario.nome || 'Você',
            modalidade: online ? 'online' : 'presencial',
            link: online ? S.form.link.trim() : '',
            local: online ? D.LOCAL_ONLINE : S.form.local.trim(),
            descricao: S.form.descricao.trim(),
            capacidade,
            livres: capacidade
        };
    }

    function previa() {
        const v = vagaDoForm();
        let corpo;
        if (!v) corpo = '<p class="vazio">Escolha um dia para ver a prévia.</p>';
        // Sem horário o card mostraria "00:00"
        else if (!S.form.hora) corpo = '<p class="vazio">Escolha o horário para ver a prévia.</p>';
        else corpo = C.cardVaga(v, { estatico: true });
        return (
            '<p class="rotulo">' + C.icone('olho', 14) + 'Prévia: como o aluno vai ver</p>' + corpo
        );
    }

    const DICAS = {
        hora: 'De 15 em 15 minutos',
        capacidade: 'Alunos por vaga',
        local: 'Ex.: Lab 3, Bloco C',
        link: 'Meet, Teams, Zoom ou Jitsi. Só quem se inscrever vê o link.'
    };

    // Plano 11: presencial ou on-line, como dois botões de opção
    function campoModalidade(atual) {
        const opcao = (valor, rotulo, ico) =>
            '<label class="mod-op' +
            (atual === valor ? ' ativa' : '') +
            '"><input type="radio" name="modalidade" value="' +
            valor +
            '"' +
            (atual === valor ? ' checked' : '') +
            '>' +
            C.icone(ico, 16) +
            rotulo +
            '</label>';
        return (
            '<fieldset class="modalidade"><legend>Modalidade</legend><div class="mod-ops">' +
            opcao('presencial', 'Presencial', 'local') +
            opcao('online', 'On-line', 'video') +
            '</div></fieldset>'
        );
    }

    function campo(id, rotulo, controle, erro, dica) {
        return (
            '<div class="campo' +
            (erro ? ' err' : '') +
            '" data-campo="' +
            id +
            '"><label for="f-' +
            id +
            '">' +
            rotulo +
            '</label>' +
            controle +
            '<span class="dica" id="d-' +
            id +
            '">' +
            esc(erro || dica || '') +
            '</span></div>'
        );
    }

    // Plano 9: resumo da série embaixo do campo "Até": quantas vagas e quais datas (as puladas
    // riscadas, porque o monitor já tem vaga no mesmo horário)
    function resumoSerie() {
        const s = D.serieDoForm(S.form, minhas());
        if (!s || s.datas.length > D.MAX_OCORRENCIAS) return '';
        const itens = s.datas
            .map((d) => {
                const pulada = s.puladas.some((p) => p.getTime() === d.getTime());
                return (
                    '<li' +
                    (pulada ? ' class="pulada"' : '') +
                    '>' +
                    D.diaMes(d) +
                    (pulada ? '<span class="sr-only"> (pulada: você já tem vaga)</span>' : '') +
                    '</li>'
                );
            })
            .join('');
        return (
            '<p class="serie-txt"><b>' +
            D.plural(s.criadas.length, 'vaga', 'vagas') +
            '</b> · ' +
            esc(D.todaSemana(s.datas[0])) +
            ' às ' +
            esc(S.form.hora) +
            '</p><ul class="serie-datas" aria-label="Datas da série">' +
            itens +
            '</ul>' +
            (s.puladas.length
                ? '<p class="serie-pulas">' +
                  C.icone('alerta', 14) +
                  (s.puladas.length === 1 ? 'A data riscada fica' : 'As datas riscadas ficam') +
                  ' de fora: você já tem vaga às ' +
                  esc(S.form.hora) +
                  '.</p>'
                : '')
        );
    }

    function campoRepetir(e, extra) {
        const f = S.form;
        const maximo = f.dia ? D.somarSemanas(f.dia, D.MAX_OCORRENCIAS - 1) : '';
        return (
            '<div class="repetir">' +
            '<label class="f-chk"><input type="checkbox" id="f-repetir"' +
            (f.repetir ? ' checked' : '') +
            '>' +
            C.icone('calendario', 16) +
            'Repetir toda semana</label>' +
            (f.repetir
                ? campo(
                      'ate',
                      'Até',
                      '<input id="f-ate" type="date"' +
                          (f.dia ? ' min="' + f.dia + '" max="' + maximo + '"' : '') +
                          ' value="' +
                          esc(f.ate) +
                          '"' +
                          extra('ate') +
                          '>',
                      e.ate,
                      'No máximo ' + D.MAX_OCORRENCIAS + ' vagas'
                  ) +
                  '<div class="serie" id="serie-resumo" aria-live="polite">' +
                  resumoSerie() +
                  '</div>'
                : '') +
            '</div>'
        );
    }

    function campos() {
        const f = S.form;
        const e = errosVisiveis();
        const extra = (id) =>
            ' aria-describedby="d-' + id + '"' + (e[id] ? ' aria-invalid="true"' : '');
        return (
            '<div class="form">' +
            (S.erroForm
                ? '<p class="erro" id="erro-form" tabindex="-1" role="alert">' +
                  esc(S.erroForm) +
                  '</p>'
                : '') +
            '<div class="dois">' +
            campo(
                'hora',
                'Horário',
                C.campoHora(
                    f.hora,
                    minhasNoDia(f.dia).map((v) => D.hora(v.inicio)),
                    extra('hora')
                ),
                e.hora,
                DICAS.hora
            ) +
            campo(
                'capacidade',
                'Lugares',
                '<input id="f-capacidade" type="number" min="1" step="1" inputmode="numeric" value="' +
                    esc(f.capacidade) +
                    '"' +
                    extra('capacidade') +
                    '>',
                e.capacidade,
                DICAS.capacidade
            ) +
            '</div>' +
            campoModalidade(f.modalidade) +
            (f.modalidade === 'online'
                ? campo(
                      'link',
                      'Link da sala',
                      '<input id="f-link" type="url" inputmode="url" maxlength="500" autocomplete="off" placeholder="https://meet.google.com/abc-defg-hij" value="' +
                          esc(f.link) +
                          '"' +
                          extra('link') +
                          '>',
                      e.link,
                      DICAS.link
                  )
                : campo(
                      'local',
                      'Local',
                      '<input id="f-local" type="text" maxlength="140" autocomplete="off" placeholder="Laboratório 3, Bloco C" value="' +
                          esc(f.local) +
                          '"' +
                          extra('local') +
                          '>',
                      e.local,
                      DICAS.local
                  )) +
            campoRepetir(e, extra) +
            campo(
                'descricao',
                'Assunto (opcional)',
                '<textarea id="f-descricao" rows="2" placeholder="Ex.: Foco em SQL Joins"' +
                    extra('descricao') +
                    '>' +
                    esc(f.descricao) +
                    '</textarea>',
                e.descricao,
                f.descricao.length + '/' + D.LIMITE_DESCRICAO
            ) +
            '<div class="previa" id="previa">' +
            previa() +
            '</div></div>'
        );
    }

    function minhasVagas(k) {
        const vagas = minhasNoDia(k);
        const itens = vagas
            .map((v) => {
                const ocupados = v.capacidade - v.livres;
                return (
                    '<li class="minha"><span class="h">' +
                    C.icone('relogio', 13) +
                    D.hora(v.inicio) +
                    '</span><span class="l">' +
                    C.icone('local', 13) +
                    esc(v.local || 'A definir') +
                    '</span><span class="chip ' +
                    (v.livres <= 0 ? 'bad' : 'info') +
                    '">' +
                    C.icone('pessoas', 12) +
                    ocupados +
                    ' de ' +
                    v.capacidade +
                    ' inscritos</span></li>'
                );
            })
            .join('');
        return (
            '<div class="minhas"><p class="rotulo">Suas vagas neste dia</p>' +
            (vagas.length
                ? '<ul>' + itens + '</ul>'
                : '<p class="nada">Nenhuma vaga sua neste dia.</p>') +
            '</div>'
        );
    }

    function botaoRevisarVaga() {
        const ok = !Object.keys(errosForm()).length;
        return (
            '<button type="button" class="btn" id="btn-revisar-vaga" data-acao="m-revisar"' +
            (ok ? '' : ' disabled') +
            '>Revisar vaga</button>'
        );
    }

    function revisaoVaga() {
        const v = vagaDoForm();
        if (!v) return '';
        const serie = D.serieDoForm(S.form, minhas());
        const n = serie ? serie.criadas.length : 1;
        return (
            '<section class="revisao" id="revisao-vaga" tabindex="-1" aria-labelledby="revv-titulo">' +
            '<p class="rotulo" id="revv-titulo">Revise a vaga antes de criar</p><dl>' +
            C.linhaResumo('Disciplina', 'livro', disciplinaNome) +
            (serie
                ? C.linhaResumo(
                      'Repete',
                      'calendario',
                      D.todaSemana(v.inicio) +
                          ', de ' +
                          D.diaMes(serie.criadas[0] || v.inicio) +
                          ' a ' +
                          D.diaMes(serie.datas[serie.datas.length - 1])
                  ) +
                  (serie.puladas.length
                      ? C.linhaResumo(
                            'Fica de fora',
                            'alerta',
                            serie.puladas.map(D.diaMes).join(', ') +
                                ' (você já tem vaga nesse horário)'
                        )
                      : '')
                : C.linhaResumo('Dia', 'calendario', D.diaLongo(v.inicio))) +
            C.linhaResumo('Horário', 'relogio', D.hora(v.inicio)) +
            (v.modalidade === 'online'
                ? C.linhaResumo('Modalidade', 'video', 'On-line') +
                  // O link fica como foi digitado (sem a maiúscula da primeira letra)
                  '<dt>' +
                  C.icone('video') +
                  'Link da sala</dt><dd class="link">' +
                  esc(v.link) +
                  '</dd>'
                : C.linhaResumo('Local', 'local', v.local)) +
            (v.descricao ? C.linhaResumo('Assunto', 'assunto', v.descricao) : '') +
            C.linhaResumo('Lugares', 'pessoas', D.plural(v.capacidade, 'aluno', 'alunos')) +
            '</dl><div class="previa"><p class="rotulo">' +
            C.icone('olho', 14) +
            'Como o aluno vai ver</p>' +
            C.cardVaga(v, { estatico: true }) +
            '</div><p class="aviso">' +
            (n > 1
                ? 'São ' +
                  n +
                  ' vagas independentes: depois dá para editar ou cancelar cada uma, ou cancelar a série a partir de uma data, sempre até 24h antes do horário.'
                : 'Depois de criada, a vaga só pode ser cancelada até 24h antes do horário.') +
            '</p>' +
            '<div class="linha acoes"><button type="button" class="btn sec" data-acao="m-editar">Editar</button>' +
            '<button type="button" class="btn" data-acao="criar"' +
            (S.enviando ? ' disabled aria-busy="true"' : '') +
            '>' +
            (S.enviando
                ? n > 1
                    ? 'Criando vagas…'
                    : 'Criando vaga…'
                : C.icone('criar', 20) + (n > 1 ? 'Criar ' + n + ' vagas' : 'Criar vaga')) +
            '</button></div></section>'
        );
    }

    function sucessoMonitor() {
        const v = S.criada;
        const serie = S.serieCriada;
        if (serie && serie.vagas.length > 1) {
            const ultima = serie.vagas[serie.vagas.length - 1];
            return (
                '<section class="sucesso" id="sucesso" tabindex="-1"><span class="ok-icone">' +
                C.icone('ok', 28, 3) +
                '</span><h2>' +
                serie.vagas.length +
                ' vagas criadas!</h2><p>' +
                esc(D.todaSemana(v.inicio)) +
                ' às ' +
                D.hora(v.inicio) +
                ', de ' +
                D.diaMes(v.inicio) +
                ' a ' +
                D.diaMes(ultima.inicio) +
                ' · ' +
                esc(v.local) +
                (serie.puladas.length
                    ? '<br>Ficaram de fora: ' +
                      serie.puladas.map(D.diaMes).join(', ') +
                      ' (você já tinha vaga nesse horário).'
                    : '') +
                '<br>Os alunos de ' +
                esc(disciplinaNome) +
                ' já podem agendar.</p><div class="linha"><button type="button" class="btn sec" data-acao="nova-vaga">Criar outra</button>' +
                '<a class="btn" href="perfil_monitor.html">Ver minhas vagas</a></div></section>'
            );
        }
        return (
            '<section class="sucesso" id="sucesso" tabindex="-1"><span class="ok-icone">' +
            C.icone('ok', 28, 3) +
            '</span><h2>Vaga criada!</h2><p>' +
            esc(D.diaLongo(v.inicio)) +
            ' às ' +
            D.hora(v.inicio) +
            ' · ' +
            esc(v.local) +
            '<br>Os alunos de ' +
            esc(disciplinaNome) +
            ' já podem agendar.</p><div class="linha"><button type="button" class="btn sec" data-acao="nova-vaga">Criar outra</button>' +
            '<a class="btn" href="perfil_monitor.html">Ver minhas vagas</a></div></section>'
        );
    }

    function telaMonitor() {
        if (S.carregando) return C.carregando('Carregando suas vagas…');
        if (S.erroCarga) return erroCarga();
        if (S.criada) return sucessoMonitor();
        if (desktop()) {
            let direita;
            if (S.m.etapa === 'revisao') direita = revisaoVaga();
            else if (S.form.dia)
                direita =
                    '<h2 class="area-titulo">Nova vaga · ' +
                    esc(D.diaCurto(D.deChave(S.form.dia))) +
                    '</h2>' +
                    minhasVagas(S.form.dia) +
                    campos() +
                    botaoRevisarVaga();
            else
                direita =
                    '<h2 class="area-titulo">Nova vaga</h2><p class="vazio">Escolha um dia no calendário para começar.</p>';
            return (
                '<div class="colunas"><div class="col"><h2 class="area-titulo">Dia da vaga</h2>' +
                calendario(S.form.dia) +
                '</div><div class="col col-dir">' +
                direita +
                '</div></div>'
            );
        }
        let passo = S.m.etapa === 'revisao' ? 3 : S.m.passo;
        if (passo > 1 && !S.form.dia) passo = 1;
        let h = '<div class="colunas">' + C.passos(['Dia', 'Detalhes', 'Revisar'], passo);
        if (passo === 1)
            h +=
                calendario(S.form.dia) +
                (S.form.dia
                    ? '<div class="linha acoes"><button type="button" class="btn" data-acao="m-passo" data-passo="2">Continuar</button></div>'
                    : '');
        else if (passo === 2)
            h +=
                C.diaSelecionado(S.form.dia, 'm-passo') +
                minhasVagas(S.form.dia) +
                campos() +
                '<div class="linha acoes"><button type="button" class="btn sec" data-acao="m-passo" data-passo="1">Voltar</button>' +
                botaoRevisarVaga() +
                '</div>';
        else h += revisaoVaga();
        return h + '</div>';
    }

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
            const controle = bloco.querySelector('input, textarea, .hora-btn');
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
        if (!id || id.indexOf('f-') !== 0) return;
        const nome = id.slice(2);
        S.form[nome] = ev.target.value;
        S.tocados[nome] = true;
        delete S.errosApi[nome];
        atualizarFormulario();
    });

    // Sair de um campo vazio obrigatório também conta como "usado" e mostra o erro
    raiz.addEventListener('focusout', (ev) => {
        const id = ev.target.id;
        if (!id || id.indexOf('f-') !== 0) return;
        // Abrir a lista de horários move o foco do botão para a lista: ainda não é "sair do campo"
        const destino = ev.relatedTarget;
        if (destino && ev.target.closest('.hora') && destino.closest('.hora')) return;
        S.tocados[id.slice(2)] = true;
        atualizarFormulario();
    });

    // --- Lista de horários (combobox/listbox) ---
    function partesHora() {
        const botao = document.getElementById('f-hora');
        const lista = document.getElementById('lista-hora');
        if (!botao || !lista) return null;
        return { botao, lista, itens: Array.from(lista.querySelectorAll('li')) };
    }

    // Marca o item ativo e rola só dentro da lista, sem mexer na página
    function marcarAtivo(p, item) {
        p.itens.forEach((x) => x.classList.toggle('ativo', x === item));
        if (!item) return;
        p.lista.setAttribute('aria-activedescendant', item.id);
        const topo = item.offsetTop;
        const fim = topo + item.offsetHeight;
        if (topo < p.lista.scrollTop) p.lista.scrollTop = topo - 4;
        else if (fim > p.lista.scrollTop + p.lista.clientHeight)
            p.lista.scrollTop = fim - p.lista.clientHeight + 4;
    }

    function abrirHora() {
        const p = partesHora();
        if (!p) return;
        p.lista.hidden = false;
        p.botao.setAttribute('aria-expanded', 'true');
        // Abre centralizada no horário escolhido (ou em 14:00, meio da tarde)
        const inicial =
            p.itens.find((x) => x.getAttribute('aria-selected') === 'true') ||
            p.itens.find((x) => x.dataset.hora === '14:00') ||
            p.itens[0];
        p.lista.scrollTop = Math.max(
            inicial.offsetTop - p.lista.clientHeight / 2 + inicial.offsetHeight / 2,
            0
        );
        marcarAtivo(p, inicial);
        p.lista.focus({ preventScroll: true });
    }

    function fecharHora(devolverFoco) {
        const p = partesHora();
        if (!p || p.lista.hidden) return;
        p.lista.hidden = true;
        p.botao.setAttribute('aria-expanded', 'false');
        p.lista.removeAttribute('aria-activedescendant');
        if (devolverFoco) p.botao.focus();
    }

    function escolherHora(item) {
        const p = partesHora();
        if (!p || !item) return;
        S.form.hora = item.dataset.hora;
        S.tocados.hora = true;
        delete S.errosApi.hora;
        p.itens.forEach((x) => x.setAttribute('aria-selected', String(x === item)));
        const valor = p.botao.querySelector('.valor');
        valor.textContent = S.form.hora;
        valor.classList.remove('sem-valor');
        fecharHora(true);
        atualizarFormulario();
    }

    raiz.addEventListener('click', (ev) => {
        if (ev.target.closest('.hora-btn')) {
            const p = partesHora();
            if (p && p.lista.hidden) abrirHora();
            else fecharHora(true);
            return;
        }
        const item = ev.target.closest('.hora-lista li');
        if (item) escolherHora(item);
    });

    raiz.addEventListener('keydown', (ev) => {
        if (
            ev.target.closest('.hora-btn') &&
            ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(ev.key)
        ) {
            ev.preventDefault();
            abrirHora();
            return;
        }
        if (!ev.target.closest('.hora-lista')) return;
        const p = partesHora();
        const atual = p.lista.querySelector('li.ativo');
        const mover = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 }[ev.key];
        if (mover) {
            ev.preventDefault();
            const i = Math.min(Math.max(p.itens.indexOf(atual) + mover, 0), p.itens.length - 1);
            marcarAtivo(p, p.itens[i]);
        } else if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            marcarAtivo(p, p.itens[ev.key === 'Home' ? 0 : p.itens.length - 1]);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            escolherHora(atual);
        } else if (ev.key === 'Escape') {
            // stopPropagation: o Esc fecha só a lista, não o menu/janelas do base.js
            ev.preventDefault();
            ev.stopPropagation();
            fecharHora(true);
        } else if (ev.key === 'Tab') {
            fecharHora(false);
        }
    });

    // Clicar fora fecha a lista
    document.addEventListener('pointerdown', (ev) => {
        if (!ev.target.closest('.hora')) fecharHora(false);
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
