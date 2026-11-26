// JS/perfil/monitor_encerrar.js
// Perfil do monitor: diálogos de finalizar a vaga (com a lista de término) e de cancelar a vaga
// ou a série (plano 9).

import { showToast, mensagemDaApi } from '../toast.js';
import { chamadaApi } from '../api.js';
import { PerfilDados } from './dados.js';

const D = PerfilDados;

/**
 * Liga os diálogos de finalizar (#dlg-finalizar) e de cancelar (#dlg-cancelar) uma vaga e
 * devolve as funções que os abrem.
 */
export function criarDialogosEncerrar({
    raiz,
    S,
    carregarHoras,
    render,
    sessaoExpirada,
    dlgFin,
    dlgCan,
    dlgDet,
    vagaPorId
}) {
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
        const opcoes = D.opcoesTermino(v.inicio);
        fimLista.innerHTML = opcoes
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
        // Atalhos de duração: só os que cabem nos términos permitidos (já passaram, até 4h)
        const maximo = opcoes.length ? opcoes[opcoes.length - 1].minutos : 0;
        dlgFin.querySelectorAll('.pp-atalhos button').forEach((b) => {
            b.hidden = Number(b.dataset.minutos) > maximo;
        });
        // Monitoria com menos de 15 min desde o início: ainda não há término para escolher
        if (!opcoes.length) {
            finErro.textContent =
                'A monitoria começou há pouco. Finalize depois de pelo menos 15 minutos.';
            fimBtn.disabled = true;
            finConfirmar.disabled = true;
        } else {
            fimBtn.disabled = false;
        }
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
            carregarHoras();
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
        const partes = [];
        if (v.inscritos)
            partes.push(
                D.plural(v.inscritos, 'aluno inscrito perde', 'alunos inscritos perdem') +
                    ' a vaga.'
            );
        else if (v.inscritos === 0) partes.push('Ninguém se inscreveu ainda.');
        // Plano 8: quem está na lista de espera também recebe o aviso do cancelamento
        if (v.naFila === 1) partes.push('Quem está na lista de espera também é avisado.');
        else if (v.naFila > 1)
            partes.push('Os ' + v.naFila + ' da lista de espera também são avisados.');
        partes.push('Esta ação não pode ser desfeita.');
        S.avisoCancelar = partes.join(' ');
        document.getElementById('can-aviso').textContent = S.avisoCancelar;
        // Plano 9: na vaga de uma série, escolher entre só esta e esta e as próximas
        const serie = D.proximasDaSerie(v, S.vagas, S.agora);
        const escopo = document.getElementById('can-escopo');
        escopo.hidden = serie.cancelaveis.length < 2;
        escopo.querySelector('input[value="esta"]').checked = true;
        S.serieAlvo = serie;
        if (!escopo.hidden) {
            const ultima = serie.cancelaveis[serie.cancelaveis.length - 1];
            document.getElementById('can-proximas').textContent =
                'Esta e as próximas: ' +
                D.plural(serie.cancelaveis.length, 'vaga', 'vagas') +
                ', até ' +
                D.diaMes(ultima.inicio);
        }
        atualizarCancelar();
        dlgCan.showModal();
    }
    // Texto do aviso e do botão conforme a escolha (só esta ou esta e as próximas)
    function atualizarCancelar() {
        const proximas =
            !document.getElementById('can-escopo').hidden &&
            document.querySelector('#can-escopo input[value="proximas"]').checked;
        const n = proximas ? S.serieAlvo.cancelaveis.length : 1;
        document.getElementById('can-confirmar').textContent =
            n > 1 ? 'Cancelar ' + n + ' vagas' : 'Cancelar vaga';
        document.getElementById('can-aviso').textContent = proximas
            ? 'Cada inscrito e quem está na lista de espera dessas vagas recebe o aviso. Esta ação não pode ser desfeita.'
            : S.avisoCancelar;
    }
    document.getElementById('can-escopo').addEventListener('change', atualizarCancelar);
    document.getElementById('can-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const vaga = S.alvo;
        if (!vaga) return;
        const botao = document.getElementById('can-confirmar');
        botao.disabled = true;
        const proximas =
            !document.getElementById('can-escopo').hidden &&
            document.querySelector('#can-escopo input[value="proximas"]').checked;
        try {
            const dados = await chamadaApi(
                '/monitorias/' + vaga.id + (proximas ? '/cancelar-proximas' : '/cancelar'),
                { method: 'PUT' }
            );
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
            dlgCan.close();
            if (proximas) {
                // Plano 9: a API devolve as canceladas e as que ficaram (menos de 24h)
                (dados.canceladas || []).forEach((id) => {
                    const v = vagaPorId(id);
                    if (v) v.status = 'cancelada';
                });
                const ficaram = (dados.mantidas || []).length;
                render();
                showToast(
                    (dados.mensagem || 'Vagas canceladas.') +
                        (ficaram
                            ? ' ' +
                              D.plural(ficaram, 'vaga ficou', 'vagas ficaram') +
                              ': faltam menos de 24h.'
                            : ''),
                    'success'
                );
                return;
            }
            vaga.status = 'cancelada';
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

    return { abrirFinalizar, abrirCancelar };
}
