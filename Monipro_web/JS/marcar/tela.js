// JS/marcar/tela.js
// Tela de marcar monitoria (aluno) e criar vaga (monitor).
// Montagem decidida pelo time: a partir de 700px, calendário + coluna lateral; abaixo disso,
// passo a passo (aluno: Dia → Horário → Confirmar; monitor: Dia → Detalhes → Revisar).
// As duas montagens usam o mesmo estado, então mudar a largura no meio do fluxo não perde nada.
// Depende de: toast.js, api.js, marcar/datas.js, marcar/componentes.js.

document.addEventListener('DOMContentLoaded', () => {
    const D = window.MarcarDatas;
    const C = window.MarcarComponentes;
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
    const token = localStorage.getItem('monipro_token');

    if (!disciplinaID || !token) {
        showToast('Informações inválidas. Redirecionando...', 'error');
        setTimeout(() => {
            window.location.href = 'base.html';
        }, 1500);
        return;
    }

    let usuario;
    try {
        usuario = JSON.parse(atob(token.split('.')[1]));
    } catch {
        localStorage.removeItem('monipro_token');
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
        erro: null,
        erroDefinitivo: false,
        // monitor
        form: { dia: null, hora: '', local: '', capacidade: '1', descricao: '' },
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
        return PERFIL === 'monitor' ? minhas() : S.vagas;
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
                situacoes[a.id_monitoria] = a.status === 'cancelado' ? 'cancelado' : 'inscrito';
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
            const [vagas, situacoes] = await Promise.all([
                buscarVagas(),
                PERFIL === 'aluno' ? buscarSituacoes() : Promise.resolve({})
            ]);
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

    async function agendar() {
        const vaga = S.vagas.find((v) => v.id === S.vagaId);
        if (!vaga || S.enviando) return;
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
                if (r.statusHttp === 409) vaga.livres = 0;
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
        capacidade: 'capacidade'
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
                    local: S.form.local.trim(),
                    descricao: S.form.descricao.trim(),
                    capacidade: Number(S.form.capacidade)
                })
            });
            if (r.success && r.monitoria) {
                const nova = D.normalizarVaga({
                    ...r.monitoria,
                    vagas_disponiveis: r.monitoria.capacidade,
                    monitor: { nome_completo: usuario.nome_completo }
                });
                S.vagas.push(nova);
                S.vagas.sort((a, b) => a.inicio - b.inicio);
                S.criada = nova;
                showToast('Vaga de monitoria criada com sucesso!', 'success');
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
        if (!noMes.length)
            resumo =
                PERFIL === 'monitor' ? 'Nenhuma vaga sua neste mês' : 'Nenhum horário neste mês';
        else
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
    function lista(semTitulo) {
        if (!S.dia) return '<p class="vazio">Selecione um dia disponível (marcado em azul).</p>';
        const vagas = D.vagasDoDia(S.vagas, S.dia);
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

    function revisao() {
        const v = S.vagas.find((x) => x.id === S.vagaId);
        if (!v) return '';
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

    function telaAluno() {
        if (S.carregando) return C.carregando('Carregando horários…');
        if (S.erroCarga) return erroCarga();
        if (S.etapa === 'sucesso') return sucessoAluno();
        if (!S.vagas.length)
            return '<p class="vazio">Ainda não há horários de monitoria para esta disciplina.</p>';
        const botaoAgendar =
            '<button type="button" class="btn" data-acao="revisar"' +
            (S.vagaId ? '' : ' disabled') +
            '>' +
            C.icone('agendar', 20) +
            'Agendar monitoria</button>';
        if (desktop()) {
            const direita =
                S.etapa === 'revisao'
                    ? revisao()
                    : '<h2 class="area-titulo">Monitores disponíveis</h2>' +
                      lista(false) +
                      botaoAgendar;
            return (
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
        if (passo === 1) h += calendario(S.dia);
        else if (passo === 2)
            h +=
                C.diaSelecionado(S.dia, 'passo') +
                lista(true) +
                '<div class="linha acoes"><button type="button" class="btn sec" data-acao="passo" data-passo="1">Voltar</button>' +
                '<button type="button" class="btn" data-acao="revisar"' +
                (S.vagaId ? '' : ' disabled') +
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
        return {
            inicio,
            monitor: usuario.nome_completo || 'Você',
            local: S.form.local.trim(),
            descricao: S.form.descricao.trim(),
            capacidade,
            livres: capacidade
        };
    }

    function previa() {
        const v = vagaDoForm();
        return (
            '<p class="rotulo">' +
            C.icone('olho', 14) +
            'Prévia: como o aluno vai ver</p>' +
            (v
                ? C.cardVaga(v, { estatico: true })
                : '<p class="vazio">Escolha um dia para ver a prévia.</p>')
        );
    }

    const DICAS = {
        hora: 'Obrigatório',
        capacidade: 'Alunos por vaga',
        local: 'Ex.: Lab 3, Bloco C'
    };

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
                '<input id="f-hora" type="time" value="' + esc(f.hora) + '"' + extra('hora') + '>',
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
            campo(
                'local',
                'Local',
                '<input id="f-local" type="text" maxlength="140" autocomplete="off" placeholder="Laboratório 3, Bloco C" value="' +
                    esc(f.local) +
                    '"' +
                    extra('local') +
                    '>',
                e.local,
                DICAS.local
            ) +
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
        return (
            '<section class="revisao" id="revisao-vaga" tabindex="-1" aria-labelledby="revv-titulo">' +
            '<p class="rotulo" id="revv-titulo">Revise a vaga antes de criar</p><dl>' +
            C.linhaResumo('Disciplina', 'livro', disciplinaNome) +
            C.linhaResumo('Dia', 'calendario', D.diaLongo(v.inicio)) +
            C.linhaResumo('Horário', 'relogio', D.hora(v.inicio)) +
            C.linhaResumo('Local', 'local', v.local) +
            (v.descricao ? C.linhaResumo('Assunto', 'assunto', v.descricao) : '') +
            C.linhaResumo('Lugares', 'pessoas', D.plural(v.capacidade, 'aluno', 'alunos')) +
            '</dl><div class="previa"><p class="rotulo">' +
            C.icone('olho', 14) +
            'Como o aluno vai ver</p>' +
            C.cardVaga(v, { estatico: true }) +
            '</div><p class="aviso">Depois de criada, a vaga só pode ser cancelada até 24h antes do horário.</p>' +
            '<div class="linha acoes"><button type="button" class="btn sec" data-acao="m-editar">Editar</button>' +
            '<button type="button" class="btn" data-acao="criar"' +
            (S.enviando ? ' disabled aria-busy="true"' : '') +
            '>' +
            (S.enviando ? 'Criando vaga…' : C.icone('criar', 20) + 'Criar vaga') +
            '</button></div></section>'
        );
    }

    function sucessoMonitor() {
        const v = S.criada;
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
        ['hora', 'capacidade', 'local', 'descricao'].forEach((id) => {
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
                    : DICAS[id]);
        });
        const caixa = document.getElementById('previa');
        if (caixa) caixa.innerHTML = previa();
        const botao = document.getElementById('btn-revisar-vaga');
        if (botao) botao.disabled = Object.keys(errosForm()).length > 0;
    }

    raiz.addEventListener('click', (ev) => {
        const alvo = ev.target.closest('[data-acao]');
        if (!alvo || alvo.disabled) return;
        const acao = alvo.dataset.acao;
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
                S.m = { passo: 2, etapa: 'form' };
                S.tocados = {};
                break;
            case 'recarregar':
                carregar();
                return;
            default:
                return;
        }
        render();
        if (acao === 'revisar') focar('revisao');
        if (acao === 'm-revisar') focar('revisao-vaga');
        if (acao === 'dia' && desktop()) {
            const dia = raiz.querySelector('.dia[data-dia="' + alvo.dataset.dia + '"]');
            if (dia) dia.focus();
        }
    });

    raiz.addEventListener('input', (ev) => {
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
        S.tocados[id.slice(2)] = true;
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
