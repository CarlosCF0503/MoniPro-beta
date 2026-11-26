// JS/perfil/aluno_dialogos.js
// Perfil do aluno: detalhes da inscrição, confirmar presença (P2, R4), cancelar inscrição ou sair
// da fila (plano 8), pedir revisão de falta com comprovante (plano 7) e avaliar (plano 6). As peças
// de cada inscrição (etiqueta, botões) vêm de JS/perfil/aluno.js.

import { showToast, mensagemDaApi } from '../toast.js';
import { chamadaApi, escaparHtml } from '../api.js';
import { PerfilDados } from './dados.js';
import { icone } from './comum.js';

const D = PerfilDados;
const esc = escaparHtml;

/**
 * Liga os diálogos do perfil do aluno (detalhes, cancelar, revisão de falta e avaliação) e
 * devolve as funções que os abrem.
 */
export function criarDialogosAluno({
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
}) {
    function preencherDetalhes(i) {
        const sit = situacao(i);
        document.getElementById('det-titulo').textContent = i.disciplina;
        let acoesDet = '';
        if (sit === 'confirmar')
            acoesDet =
                '<div class="pp-det-acoes">' + botaoConfirmar(i, 'pp-btn pp-btn-pri') + '</div>';
        else if (sit === 'fila')
            acoesDet = '<div class="pp-det-acoes">' + botaoCancelar(i) + '</div>';
        else if (sit === 'confirmada' && avaliacaoHTML(i))
            acoesDet = '<div class="pp-det-acoes">' + avaliacaoHTML(i) + '</div>';
        else if (sit === 'ausente')
            acoesDet =
                '<div class="pp-det-acoes">' +
                (situacaoRecurso(i) === 'pode' ? botaoRecurso(i) : notaRecurso(i)) +
                '</div>';
        else if (sit === 'antes')
            acoesDet =
                '<div class="pp-det-acoes">' +
                botaoSala(i) +
                botaoAgenda(i) +
                '</div>' +
                (D.podeCancelarInscricao(i, S.agora)
                    ? (i.liberado
                          ? '<p class="nota-24h nota-bloco">' +
                            icone('relogio', 14) +
                            '<span>' +
                            esc(textoMudou(i)) +
                            ' Você pode cancelar até o início.</span></p>'
                          : '') +
                      '<div class="pp-det-acoes">' +
                      botaoCancelar(i) +
                      '</div>'
                    : '<p class="nota-24h nota-bloco">' +
                      icone('relogio', 14) +
                      AVISO_24H +
                      '. Faltam menos de ' +
                      D.HORAS_CANCELAMENTO +
                      'h para o início.</p>');
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
            (i.online ? 'On-line' : esc(i.local)) +
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
                carregarExtrato();
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

    // O mesmo diálogo serve para cancelar a inscrição e para sair da lista de espera (plano 8)
    const TEXTOS_CANCELAR = {
        inscricao: {
            titulo: 'Cancelar sua inscrição?',
            aviso: 'A vaga fica livre para outro aluno.',
            manter: 'Manter inscrição',
            confirmar: 'Cancelar inscrição',
            feito: 'Inscrição cancelada.'
        },
        fila: {
            titulo: 'Sair da lista de espera?',
            aviso: 'Você perde a sua posição. Para voltar, entre de novo no fim da fila.',
            manter: 'Continuar na fila',
            confirmar: 'Sair da fila',
            feito: 'Você saiu da lista de espera.'
        }
    };
    const textosCancelar = (i) => TEXTOS_CANCELAR[i.naFila ? 'fila' : 'inscricao'];
    function abrirCancelar(i) {
        S.alvo = i;
        const t = textosCancelar(i);
        document.getElementById('can-titulo').textContent = t.titulo;
        document.getElementById('can-aviso').textContent = t.aviso;
        document.getElementById('can-manter').textContent = t.manter;
        document.getElementById('can-confirmar').textContent = t.confirmar;
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
            showToast(textosCancelar(i).feito, 'success');
            // Quem estava atrás na mesma fila anda uma posição (plano 8)
            if (i.naFila) carregar();
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
        } finally {
            botao.disabled = false;
        }
    });

    // Plano 7: pedir revisão da falta com o atestado (PDF, JPG ou PNG, até 5 MB)
    const dlgRec = document.getElementById('dlg-recurso');
    function abrirRecurso(i) {
        S.alvo = i;
        document.getElementById('rec-sub').textContent =
            i.disciplina + ' · ' + D.diaCurto(i.inicio) + ' às ' + D.hora(i.inicio);
        document.getElementById('rec-justificativa').value = '';
        document.getElementById('rec-arquivo').value = '';
        document.getElementById('rec-erro').textContent = '';
        dlgRec.showModal();
    }
    const lerBase64 = (arquivo) =>
        new Promise((ok, falha) => {
            const leitor = new FileReader();
            leitor.onload = () => ok(String(leitor.result).split(',')[1] || '');
            leitor.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
            leitor.readAsDataURL(arquivo);
        });
    document.getElementById('rec-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const i = S.alvo;
        if (!i) return;
        const erro = document.getElementById('rec-erro');
        const justificativa = document.getElementById('rec-justificativa').value.trim();
        const arquivo = document.getElementById('rec-arquivo').files[0];
        if (justificativa.length < 10) {
            erro.textContent = 'Explique o motivo da falta com pelo menos 10 caracteres.';
            return;
        }
        if (!arquivo) {
            erro.textContent = 'Anexe o atestado ou outro comprovante.';
            return;
        }
        if (!TIPOS_ANEXO.includes(arquivo.type)) {
            erro.textContent = 'O comprovante precisa ser PDF, JPG ou PNG.';
            return;
        }
        if (arquivo.size > MAX_ANEXO) {
            erro.textContent =
                'O arquivo passa de 5 MB. Tire a foto com menos resolução ou envie em PDF.';
            return;
        }
        const botao = document.getElementById('rec-enviar');
        botao.disabled = true;
        try {
            const dados = await chamadaApi('/agendamentos/' + i.id + '/recurso', {
                method: 'POST',
                body: JSON.stringify({
                    justificativa,
                    arquivo: {
                        nome: arquivo.name,
                        tipo: arquivo.type,
                        conteudo: await lerBase64(arquivo)
                    }
                })
            });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (!dados.success) {
                erro.textContent = mensagemDaApi(dados, 'Não foi possível enviar o pedido.');
                return;
            }
            i.recurso = dados.recurso;
            dlgRec.close();
            showToast(
                'Pedido enviado. A coordenação analisa e você recebe a resposta por e-mail.',
                'success'
            );
            render();
        } catch (e) {
            erro.textContent = e.message || 'Não foi possível enviar o pedido.';
        } finally {
            botao.disabled = false;
        }
    });

    // Plano 6: diálogo de avaliação
    const dlgAva = document.getElementById('dlg-avaliar');
    function abrirAvaliar(i) {
        S.alvo = i;
        document.getElementById('ava-sub').textContent =
            i.disciplina + ' com ' + i.monitor + ' · ' + D.diaCurto(i.inicio);
        document
            .querySelectorAll('#ava-form input[name="nota"]')
            .forEach((r) => (r.checked = false));
        document.getElementById('ava-comentario').value = '';
        document.getElementById('ava-erro').textContent = '';
        document.getElementById('ava-escolha').textContent = 'Toque numa nota de 1 a 5';
        dlgAva.showModal();
    }
    document.getElementById('ava-form').addEventListener('change', (ev) => {
        if (ev.target.name !== 'nota') return;
        document.getElementById('ava-escolha').textContent =
            ev.target.value + ' de 5 · ' + SIGNIFICADO[ev.target.value];
        document.getElementById('ava-erro').textContent = '';
    });
    document.getElementById('ava-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const i = S.alvo;
        if (!i) return;
        const marcada = document.querySelector('#ava-form input[name="nota"]:checked');
        const erro = document.getElementById('ava-erro');
        if (!marcada) {
            erro.textContent = 'Escolha uma nota de 1 a 5.';
            return;
        }
        const comentario = document.getElementById('ava-comentario').value.trim();
        const botao = document.getElementById('ava-enviar');
        botao.disabled = true;
        try {
            const dados = await chamadaApi('/agendamentos/' + i.id + '/avaliacao', {
                method: 'POST',
                body: JSON.stringify({
                    nota: Number(marcada.value),
                    comentario: comentario || undefined
                })
            });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (!dados.success) {
                erro.textContent = mensagemDaApi(dados, 'Não foi possível enviar a avaliação.');
                return;
            }
            i.avaliacao = { nota: Number(marcada.value) };
            dlgAva.close();
            showToast('Obrigado! Sua avaliação foi enviada sem o seu nome.', 'success');
            render();
        } catch (e) {
            erro.textContent = e.message || 'Não foi possível enviar a avaliação.';
        } finally {
            botao.disabled = false;
        }
    });

    // Fechar pelos botões "Voltar"/X e devolver o foco a quem abriu
    document.addEventListener('click', (ev) => {
        const b = ev.target.closest('.pp-dlg [data-fechar]');
        if (b) b.closest('dialog').close();
    });
    [dlgCan, dlgDet, dlgRec, dlgAva].forEach((d) =>
        d.addEventListener('close', () => {
            if (document.querySelector('.pp-dlg[open]')) return;
            if (S.gatilho && document.body.contains(S.gatilho)) S.gatilho.focus();
            else {
                const alvo = raiz.querySelector('[aria-selected="true"], h1');
                if (alvo) alvo.focus({ preventScroll: true });
            }
        })
    );

    return { abrirDetalhes, confirmarPresenca, abrirCancelar, abrirRecurso, abrirAvaliar };
}
