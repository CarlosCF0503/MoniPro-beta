// JS/perfil/monitor_detalhes.js
// Perfil do monitor: detalhes da vaga com os inscritos, confirmação de presença (P2, R4) e falta
// (plano 12). As peças de cada vaga (etiqueta, botões) vêm de JS/perfil/monitor.js.

import { showToast, mensagemDaApi } from '../toast.js';
import { chamadaApi, escaparHtml } from '../api.js';
import { PerfilDados } from './dados.js';
import { icone } from './comum.js';

const D = PerfilDados;
const esc = escaparHtml;

/**
 * Liga o painel de detalhes da vaga (#dlg-detalhes), com a lista de inscritos, e devolve as
 * funções de abrir os detalhes, confirmar a presença e marcar a falta de um aluno.
 */
export function criarDetalhesVaga({
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
}) {
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
                '. Se o aluno não veio, marque a falta.';
        const itens = lista
            .map((i) => {
                const sit = D.situacaoPresenca(i, v, S.agora, 'monitor');
                const noPrazo = S.agora >= v.inicio && S.agora <= D.limiteConfirmacao(v);
                // Plano 12: "Faltou" ao lado da presença enquanto não está concluída
                const botaoFalta =
                    '<button type="button" class="pp-btn pp-btn-texto-perigo pp-btn-p" data-acao="ausencia" data-id="' +
                    esc(v.id) +
                    '" data-ag="' +
                    esc(i.id) +
                    '" aria-label="Marcar falta de ' +
                    esc(i.aluno) +
                    '">Faltou</button>';
                let lado = '';
                if (sit === 'confirmar')
                    lado =
                        '<span class="pp-insc-acoes">' +
                        botaoFalta +
                        '<button type="button" class="pp-btn pp-btn-sec pp-btn-p" data-acao="presenca" data-id="' +
                        esc(v.id) +
                        '" data-ag="' +
                        esc(i.id) +
                        '" aria-label="Confirmar presença de ' +
                        esc(i.aluno) +
                        '">Confirmar presença</button></span>';
                else if (sit === 'ausente')
                    lado =
                        '<span class="pp-insc-acoes"><span class="pill pill-perigo" tabindex="-1" id="pres-' +
                        esc(i.id) +
                        '">' +
                        icone('x', 12) +
                        'Faltou</span>' +
                        (noPrazo
                            ? '<button type="button" class="pp-btn pp-btn-sec pp-btn-p" data-acao="presenca" data-id="' +
                              esc(v.id) +
                              '" data-ag="' +
                              esc(i.id) +
                              '" aria-label="Corrigir: ' +
                              esc(i.aluno) +
                              ' estava presente">Estava presente</button>'
                            : '') +
                        '</span>';
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
                        'Aguardando o aluno</span>' +
                        (noPrazo ? botaoFalta : '');
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
                ? '<div class="pp-det-acoes">' +
                  botaoEditar(v) +
                  botaoAgenda(v) +
                  botaoCancelar(v) +
                  '</div>'
                : '<div class="pp-det-acoes">' +
                  botaoEditar(v) +
                  botaoAgenda(v) +
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
            inscricao.ausente = false; // plano 12: confirmar a presença desfaz a falta
            if (dados.concluido) {
                inscricao.status = 'concluido';
                if (S.usuario)
                    S.usuario.pontos = (Number(S.usuario.pontos) || 0) + D.PONTOS_MONITOR;
                carregarHoras();
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

    // Plano 12: PATCH /agendamentos/:id/ausencia. Desfazer = "Estava presente" (confirmar)
    async function marcarAusencia(botao) {
        const vaga = vagaPorId(botao.dataset.id);
        const inscricao = vaga && inscricoesDa(vaga).find((i) => String(i.id) === botao.dataset.ag);
        if (!inscricao) return;
        botao.disabled = true;
        botao.textContent = 'Marcando…';
        try {
            const dados = await chamadaApi('/agendamentos/' + inscricao.id + '/ausencia', {
                method: 'PATCH'
            });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (dados.erro || !dados.success) {
                showToast(mensagemDaApi(dados, 'Não foi possível marcar a falta.'), 'error', dados);
                botao.disabled = false;
                botao.textContent = 'Faltou';
                return;
            }
            inscricao.ausente = true;
            inscricao.monitorConfirmou = false;
            render();
            preencherDetalhes(vaga);
            const marca = document.getElementById('pres-' + inscricao.id);
            if (marca) marca.focus();
            showToast('Falta de ' + inscricao.aluno + ' registrada.', 'success');
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
            botao.disabled = false;
            botao.textContent = 'Faltou';
        }
    }

    return { abrirDetalhes, confirmarPresenca, marcarAusencia };
}
