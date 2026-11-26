// JS/painel.js
// Plano 7 (RF-012): painel da coordenação. As rotas /admin/* exigem tipo_usuario = coordenador
// (middleware isCoordenador; aluno e monitor recebem 403) e toda ação de escrita entra na auditoria.
// Os blocos (indicadores, gráficos e abas) são montados em JS/painel/blocos.js; aqui ficam a
// carga dos dados, o desenho da página e os diálogos de cada ação.
// Depende de: api.js (chamadaApi, escaparHtml, obterSessao), toast.js (showToast,
// mensagemDaApi).

import { showToast, mensagemDaApi } from './toast.js';
import { chamadaApi, obterSessao, escaparHtml } from './api.js';
import { horas, FUSO, dataHora } from './painel/formato.js';
import { criarIndicadores } from './painel/indicadores.js';
import { criarAbas } from './painel/abas.js';

document.addEventListener('DOMContentLoaded', async () => {
    const esc = escaparHtml;
    const raiz = document.getElementById('painel-app');
    let usuario = null;
    try {
        usuario = await obterSessao();
    } catch {
        raiz.setAttribute('aria-busy', 'false');
        raiz.innerHTML =
            '<p class="pp-carregando">Não foi possível conectar ao servidor. Recarregue a página.</p>';
        return;
    }
    if (!usuario || usuario.tipo !== 'coordenador') {
        window.location.href = usuario ? 'base.html' : 'index.html?perfil=coordenacao';
        return;
    }

    const S = {
        periodo: null,
        aba: 'certificados',
        filtroCert: 'pendente',
        resumo: null,
        monitores: [],
        certificados: { pendente: [], assinado: [] },
        disciplinas: [],
        aprovadas: [],
        faltas: { recursos: [], faltas: [], sem_presenca: [], bloqueados: [] },
        avaliacoes: [],
        filtroAval: 'visiveis',
        filtroFalta: 'recursos',
        auditoria: []
    };

    // ---------- dados ----------
    async function carregar() {
        raiz.setAttribute('aria-busy', 'true');
        const q = S.periodo ? '?periodo=' + encodeURIComponent(S.periodo) : '';
        const ps = q ? '&' + q.slice(1) : '';
        let r, m, a, cp, ca, di, fa, av;
        try {
            [r, m, a, cp, ca, di, fa, av] = await Promise.all([
                chamadaApi('/admin/resumo' + q),
                chamadaApi('/admin/monitores' + q),
                chamadaApi('/admin/auditoria?limit=20'),
                chamadaApi('/admin/certificados?situacao=pendente'),
                chamadaApi('/admin/certificados?situacao=assinado' + ps),
                chamadaApi('/admin/disciplinas'),
                chamadaApi('/admin/faltas' + q),
                chamadaApi('/admin/avaliacoes' + q)
            ]);
        } catch {
            r = { success: false, erro: 'Não foi possível conectar ao servidor.' };
        }
        if (!r.success) {
            raiz.setAttribute('aria-busy', 'false');
            raiz.innerHTML =
                '<p class="pp-carregando">' +
                esc(r.erro || 'Não foi possível carregar o painel.') +
                '</p>';
            return;
        }
        S.resumo = r;
        S.periodo = r.periodo;
        S.monitores = (m && m.monitores) || [];
        S.auditoria = (a && a.registros) || [];
        S.certificados = {
            pendente: (cp && cp.certificados) || [],
            assinado: (ca && ca.certificados) || []
        };
        S.disciplinas = (di && di.disciplinas) || [];
        S.aprovadas = (di && di.aprovadas) || [];
        S.avaliacoes = (av && av.avaliacoes) || [];
        S.faltas = {
            recursos: (fa && fa.recursos) || [],
            faltas: (fa && fa.faltas) || [],
            sem_presenca: (fa && fa.sem_presenca) || [],
            bloqueados: (fa && fa.bloqueados) || []
        };
        render();
    }

    // ---------- blocos (JS/painel/indicadores.js e JS/painel/abas.js) ----------
    const {
        pendencias,
        kpis,
        graficoSemanas,
        graficoDisciplinas,
        graficoInscricoes,
        graficoHorarios
    } = criarIndicadores({ S });
    const { codigoLegivel, gestao } = criarAbas({ S });

    function render() {
        raiz.setAttribute('aria-busy', 'false');
        const r = S.resumo;
        raiz.innerHTML =
            '<div class="pp-desk pn-desk">' +
            '<div class="pp-cabecalho"><div><h1>Painel da coordenação <span class="chip chip-papel">Coordenação</span></h1>' +
            '<p>' +
            esc(usuario.nome) +
            ' · ' +
            esc(r.rotulo_periodo) +
            ' · dados até ' +
            dataHora(r.atualizado_em) +
            '</p></div>' +
            '<label class="pn-sem" for="pn-sem">Semestre <select id="pn-sem">' +
            r.periodos
                .map(
                    (p) =>
                        '<option' +
                        (p === S.periodo ? ' selected' : '') +
                        '>' +
                        esc(p) +
                        '</option>'
                )
                .join('') +
            '</select></label></div>' +
            pendencias() +
            kpis() +
            '<div class="pn-graficos">' +
            graficoSemanas() +
            graficoDisciplinas() +
            graficoInscricoes() +
            graficoHorarios() +
            '</div>' +
            gestao() +
            '</div>';
    }

    // ---------- certificados: diálogos e ações ----------
    const dlgSes = document.getElementById('dlg-sessoes');
    const dlgRev = document.getElementById('dlg-revogar');
    document
        .querySelectorAll('.pp-dlg [data-fechar]')
        .forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
    const dataLonga = (iso) =>
        new Date(iso).toLocaleString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            ...FUSO
        });

    async function abrirSessoes(c) {
        document.getElementById('ses-titulo').textContent = c.monitor + ' · ' + c.periodo;
        const lista = document.getElementById('ses-lista');
        const total = document.getElementById('ses-total');
        lista.innerHTML = '<li><small>Carregando…</small></li>';
        total.textContent = '';
        document.getElementById('ses-assinar').dataset.id = c.id;
        dlgSes.showModal();
        let r;
        try {
            r = await chamadaApi('/admin/certificados/' + c.id + '/sessoes');
        } catch {
            r = { success: false };
        }
        if (!r.success) {
            lista.innerHTML =
                '<li><small>' +
                esc(r.erro || 'Não foi possível carregar as sessões.') +
                '</small></li>';
            return;
        }
        lista.innerHTML =
            r.sessoes
                .map(
                    (s) =>
                        '<li><div><b>' +
                        esc(s.disciplina) +
                        '</b><small>' +
                        esc(dataLonga(s.data)) +
                        '</small></div><span class="h">' +
                        horas(s.minutos) +
                        '</span></li>'
                )
                .join('') || '<li><small>Nenhuma sessão guardada neste certificado.</small></li>';
        total.innerHTML =
            '<span>' +
            r.sessoes.length +
            (r.sessoes.length === 1 ? ' sessão' : ' sessões') +
            ' com presença confirmada</span><b>' +
            horas(r.carga_minutos) +
            '</b>';
    }

    function abrirRevogar(c) {
        document.getElementById('rev-sub').textContent =
            c.monitor +
            ' · ' +
            c.periodo +
            ' · ' +
            horas(c.carga_minutos) +
            ' · código ' +
            codigoLegivel(c.codigo);
        const motivo = document.getElementById('rev-motivo');
        motivo.value = '';
        document.getElementById('rev-erro').textContent = '';
        document.getElementById('rev-confirmar').dataset.id = c.id;
        dlgRev.showModal();
        motivo.focus();
    }

    async function executar(botao, rota, corpo, sucesso) {
        botao.disabled = true;
        let r;
        try {
            r = await chamadaApi(rota, {
                method: 'POST',
                body: corpo ? JSON.stringify(corpo) : undefined
            });
        } catch {
            r = { success: false, erro: 'Não foi possível conectar ao servidor.' };
        }
        botao.disabled = false;
        if (!r.success) {
            showToast(mensagemDaApi(r, 'Não foi possível concluir. Tente de novo.'), 'error');
            return null;
        }
        if (r.registro) S.auditoria.unshift(r.registro);
        showToast(sucesso, 'success');
        return r;
    }

    async function assinar(id, botao) {
        const c = S.certificados.pendente.find((x) => x.id === id);
        if (!c) return;
        const r = await executar(
            botao,
            '/admin/certificados/' + id + '/assinar',
            null,
            'Certificado de ' + c.monitor + ' assinado. O monitor recebe um e-mail.'
        );
        if (!r) return;
        S.certificados.pendente = S.certificados.pendente.filter((x) => x.id !== id);
        if (c.periodo === S.periodo) S.certificados.assinado.unshift(r.certificado);
        const m = S.monitores.find((x) => x.nome === c.monitor);
        if (m && c.periodo === S.periodo) m.certificado = 'assinado';
        if (dlgSes.open) dlgSes.close();
        render();
    }

    document
        .getElementById('ses-assinar')
        .addEventListener('click', (ev) =>
            assinar(Number(ev.currentTarget.dataset.id), ev.currentTarget)
        );

    document.getElementById('rev-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('rev-confirmar');
        const id = Number(b.dataset.id);
        const motivo = document.getElementById('rev-motivo').value.trim();
        if (motivo.length < 10) {
            document.getElementById('rev-erro').textContent =
                'Escreva o motivo com pelo menos 10 caracteres. Ele vai no e-mail para o monitor.';
            return;
        }
        const c = S.certificados.assinado.find((x) => x.id === id);
        const r = await executar(
            b,
            '/admin/certificados/' + id + '/revogar',
            { motivo },
            'Certificado revogado. O código já aparece como revogado na verificação.'
        );
        if (!r) return;
        S.certificados.assinado = S.certificados.assinado.filter((x) => x.id !== id);
        const m = c && S.monitores.find((x) => x.nome === c.monitor);
        if (m) m.certificado = 'nenhum';
        dlgRev.close();
        render();
    });

    // ---------- disciplinas: aprovar e mesclar ----------
    const dlgMes = document.getElementById('dlg-mesclar');

    function abrirMesclar(d) {
        document.getElementById('mes-sub').textContent =
            '"' +
            d.nome +
            '"' +
            (d.criador ? ', pedida por ' + d.criador : '') +
            ' · ' +
            d.vagas +
            (d.vagas === 1 ? ' vaga' : ' vagas');
        const sel = document.getElementById('mes-destino');
        sel.innerHTML = S.aprovadas
            .map(
                (x) =>
                    '<option value="' +
                    x.id +
                    '"' +
                    (d.parecida && x.id === d.parecida.id ? ' selected' : '') +
                    '>' +
                    esc(x.nome) +
                    '</option>'
            )
            .join('');
        document.getElementById('mes-confirmar').dataset.id = d.id;
        dlgMes.showModal();
    }

    async function aprovarDisciplina(id, botao) {
        const d = S.disciplinas.find((x) => x.id === id);
        if (!d) return;
        const r = await executar(
            botao,
            '/admin/disciplinas/' + id + '/aprovar',
            null,
            '"' + d.nome + '" aprovada. Os alunos já veem a disciplina e as vagas.'
        );
        if (!r) return;
        S.disciplinas = S.disciplinas.filter((x) => x.id !== id);
        S.aprovadas = S.aprovadas
            .concat({ id: d.id, nome: d.nome })
            .sort((a, b) => a.nome.localeCompare(b.nome));
        render();
    }

    document.getElementById('mes-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('mes-confirmar');
        const id = Number(b.dataset.id);
        const destino = Number(document.getElementById('mes-destino').value);
        const alvo = S.aprovadas.find((x) => x.id === destino);
        const r = await executar(
            b,
            '/admin/disciplinas/' + id + '/mesclar',
            { id_destino: destino },
            'Disciplinas mescladas. As vagas agora aparecem em ' +
                (alvo ? alvo.nome : 'outra disciplina') +
                '.'
        );
        if (!r) return;
        S.disciplinas = S.disciplinas.filter((x) => x.id !== id);
        dlgMes.close();
        render();
    });

    // ---------- faltas: marcar e anular ----------
    const dlgAnu = document.getElementById('dlg-anular');
    const dlgFal = document.getElementById('dlg-falta');
    const descricaoSessao = (x) =>
        x.aluno + ' · ' + x.disciplina + ' com ' + x.monitor + ' · ' + dataHora(x.horario);

    function abrirAnular(x) {
        document.getElementById('anu-sub').textContent = descricaoSessao(x);
        const motivo = document.getElementById('anu-motivo');
        motivo.value = '';
        document.getElementById('anu-erro').textContent = '';
        document.getElementById('anu-confirmar').dataset.id = x.id;
        dlgAnu.showModal();
        motivo.focus();
    }

    function abrirMarcar(x) {
        document.getElementById('fal-sub').textContent = descricaoSessao(x);
        document.getElementById('fal-confirmar').dataset.id = x.id;
        dlgFal.showModal();
    }

    document.getElementById('anu-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('anu-confirmar');
        const id = Number(b.dataset.id);
        const motivo = document.getElementById('anu-motivo').value.trim();
        if (motivo.length < 10) {
            document.getElementById('anu-erro').textContent =
                'Escreva a justificativa com pelo menos 10 caracteres. Ela fica no registro de atividade.';
            return;
        }
        const r = await executar(
            b,
            '/admin/agendamentos/' + id + '/anular-falta',
            { motivo },
            'Falta anulada. O bloqueio do aluno, se houver, já foi recalculado.'
        );
        if (!r) return;
        dlgAnu.close();
        carregar();
    });

    document.getElementById('fal-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('fal-confirmar');
        const r = await executar(
            b,
            '/admin/agendamentos/' + Number(b.dataset.id) + '/falta',
            null,
            'Falta marcada. Ela aparece no perfil do aluno.'
        );
        if (!r) return;
        dlgFal.close();
        S.filtroFalta = 'faltas';
        carregar();
    });

    // ---------- recursos de falta: aceitar e recusar ----------
    const dlgRecusar = document.getElementById('dlg-recusar');
    async function aceitarRecurso(id, botao) {
        const x = S.faltas.recursos.find((r) => r.id === id);
        if (!x) return;
        const r = await executar(
            botao,
            '/admin/recursos/' + id + '/aceitar',
            null,
            'Pedido aceito e falta anulada. ' + x.aluno + ' recebe a resposta por e-mail.'
        );
        if (r) carregar();
    }
    function abrirRecusar(x) {
        document.getElementById('rcs-sub').textContent =
            x.aluno + ' · ' + x.disciplina + ' · ' + dataHora(x.horario);
        const motivo = document.getElementById('rcs-motivo');
        motivo.value = '';
        document.getElementById('rcs-erro').textContent = '';
        document.getElementById('rcs-confirmar').dataset.id = x.id;
        dlgRecusar.showModal();
        motivo.focus();
    }
    document.getElementById('rcs-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('rcs-confirmar');
        const motivo = document.getElementById('rcs-motivo').value.trim();
        if (motivo.length < 10) {
            document.getElementById('rcs-erro').textContent =
                'Escreva o motivo com pelo menos 10 caracteres. O aluno recebe esse texto por e-mail.';
            return;
        }
        const r = await executar(
            b,
            '/admin/recursos/' + Number(b.dataset.id) + '/recusar',
            { motivo },
            'Pedido recusado. O aluno recebe o motivo por e-mail.'
        );
        if (!r) return;
        dlgRecusar.close();
        carregar();
    });

    // ---------- avaliações: ocultar e mostrar de novo ----------
    const dlgOcu = document.getElementById('dlg-ocultar');
    function abrirOcultar(x) {
        document.getElementById('ocu-sub').textContent = '"' + x.comentario + '" · ' + x.monitor;
        const motivo = document.getElementById('ocu-motivo');
        motivo.value = '';
        document.getElementById('ocu-erro').textContent = '';
        document.getElementById('ocu-confirmar').dataset.id = x.id;
        dlgOcu.showModal();
        motivo.focus();
    }
    document.getElementById('ocu-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const b = document.getElementById('ocu-confirmar');
        const motivo = document.getElementById('ocu-motivo').value.trim();
        if (motivo.length < 10) {
            document.getElementById('ocu-erro').textContent =
                'Escreva o motivo com pelo menos 10 caracteres. Ele fica no registro de atividade.';
            return;
        }
        const r = await executar(
            b,
            '/admin/avaliacoes/' + Number(b.dataset.id) + '/ocultar',
            { motivo },
            'Comentário oculto. O monitor deixa de ver o texto, e a nota sai da média.'
        );
        if (!r) return;
        dlgOcu.close();
        carregar();
    });
    async function reexibir(id, botao) {
        const r = await executar(
            botao,
            '/admin/avaliacoes/' + id + '/reexibir',
            null,
            'O comentário voltou a aparecer para o monitor, e a nota volta a contar na média.'
        );
        if (r) carregar();
    }

    // ---------- eventos ----------
    raiz.addEventListener('change', (ev) => {
        if (ev.target.id === 'pn-sem') {
            S.periodo = ev.target.value;
            carregar();
        }
    });

    raiz.addEventListener('click', (ev) => {
        const ir = ev.target.closest('[data-pn-ir]');
        if (ir) {
            S.aba = ir.dataset.pnIr;
            if (S.aba === 'certificados') S.filtroCert = 'pendente';
            if (S.aba === 'faltas') S.filtroFalta = 'recursos';
            render();
            document
                .getElementById('pn-gestao')
                .scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        const aba = ev.target.closest('[data-pn-aba]');
        if (aba) {
            S.aba = aba.dataset.pnAba;
            render();
            document.getElementById('aba-' + S.aba).focus();
            return;
        }
        const fa = ev.target.closest('[data-pn-aval]');
        if (fa) {
            S.filtroAval = fa.dataset.pnAval;
            render();
            return;
        }
        const ff = ev.target.closest('[data-pn-falta]');
        if (ff) {
            S.filtroFalta = ff.dataset.pnFalta;
            render();
            return;
        }
        const fc = ev.target.closest('[data-pn-cert]');
        if (fc) {
            S.filtroCert = fc.dataset.pnCert;
            render();
            return;
        }
        const b = ev.target.closest('[data-pn]');
        if (!b) return;
        const id = Number(b.dataset.id);
        if (b.dataset.pn === 'sessoes')
            return abrirSessoes(S.certificados.pendente.find((x) => x.id === id));
        if (b.dataset.pn === 'assinar') return assinar(id, b);
        if (b.dataset.pn === 'revogar')
            return abrirRevogar(S.certificados.assinado.find((x) => x.id === id));
        if (b.dataset.pn === 'mesclar') return abrirMesclar(S.disciplinas.find((x) => x.id === id));
        if (b.dataset.pn === 'aprovar') return aprovarDisciplina(id, b);
        if (b.dataset.pn === 'anular') return abrirAnular(S.faltas.faltas.find((x) => x.id === id));
        if (b.dataset.pn === 'aceitar-recurso') return aceitarRecurso(id, b);
        if (b.dataset.pn === 'ocultar') return abrirOcultar(S.avaliacoes.find((x) => x.id === id));
        if (b.dataset.pn === 'reexibir') return reexibir(id, b);
        if (b.dataset.pn === 'recusar-recurso')
            return abrirRecusar(S.faltas.recursos.find((x) => x.id === id));
        if (b.dataset.pn === 'marcar-falta')
            return abrirMarcar(S.faltas.sem_presenca.find((x) => x.id === id));
    });

    carregar();
});
