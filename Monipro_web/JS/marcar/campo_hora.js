// JS/marcar/campo_hora.js
// Campo de horário digitável (combobox editável do WAI-ARIA, com lista de sugestões). O monitor
// digita o minuto exato (14:43) ou escolhe uma sugestão de 15 em 15. Usado em "Abrir nova vaga"
// (marcar/tela.js) e em "Editar vaga" (perfil/monitor.js). Máscara, formato e limites ficam em
// datas.js (testados no Jest).
//
// Estrutura esperada:
//   <div data-hora-caixa>
//     <input data-hora-campo role="combobox" aria-controls="ID" aria-expanded="false" ...>
//     <button type="button" data-hora-abrir tabindex="-1" aria-label="Mostrar sugestões">…</button>
//     <ul id="ID" role="listbox" hidden><li role="option" data-hora="14:00" id="…">14:00</li>…</ul>
//   </div>
// O foco fica sempre no campo; a opção ativa é indicada por aria-activedescendant.

import { MarcarDatas } from './datas.js';

const D = MarcarDatas;

function partes(el) {
    const caixa = el && el.closest('[data-hora-caixa]');
    if (!caixa) return null;
    const input = caixa.querySelector('[data-hora-campo]');
    const lista = input && document.getElementById(input.getAttribute('aria-controls'));
    if (!lista) return null;
    return {
        caixa,
        input,
        lista,
        botao: caixa.querySelector('[data-hora-abrir]'),
        itens: Array.from(lista.querySelectorAll('[role="option"]'))
    };
}

function rolarAte(p, item, centralizar) {
    if (!item) return;
    const topo = item.offsetTop;
    const fim = topo + item.offsetHeight;
    if (centralizar)
        p.lista.scrollTop = Math.max(topo - p.lista.clientHeight / 2 + item.offsetHeight / 2, 0);
    else if (topo < p.lista.scrollTop) p.lista.scrollTop = topo - 4;
    else if (fim > p.lista.scrollTop + p.lista.clientHeight)
        p.lista.scrollTop = fim - p.lista.clientHeight + 4;
}

function marcarAtivo(p, item) {
    p.itens.forEach((x) => x.classList.toggle('ativo', x === item));
    if (item) {
        p.input.setAttribute('aria-activedescendant', item.id);
        rolarAte(p, item, false);
    } else p.input.removeAttribute('aria-activedescendant');
}

function marcarEscolhido(p, valor) {
    p.itens.forEach((x) => x.setAttribute('aria-selected', String(x.dataset.hora === valor)));
}

// Sugestão de referência: a escolhida, a mais perto do que foi digitado ou 14:00 (meio da tarde)
function referencia(p) {
    const lista = p.itens.map((x) => x.dataset.hora);
    const valor = D.sugestaoMaisPerto(lista, p.input.value) || '14:00';
    return p.itens.find((x) => x.dataset.hora === valor) || p.itens[0];
}

function aberta(p) {
    return p && !p.lista.hidden;
}

function abrir(p, ativar) {
    if (!p || p.input.disabled || !p.itens.length) return;
    p.lista.hidden = false;
    p.input.setAttribute('aria-expanded', 'true');
    if (p.botao) p.botao.setAttribute('aria-expanded', 'true');
    const ref = referencia(p);
    rolarAte(p, ref, true);
    marcarAtivo(p, ativar ? ref : null);
}

function fechar(p) {
    if (!aberta(p)) return;
    p.lista.hidden = true;
    p.input.setAttribute('aria-expanded', 'false');
    if (p.botao) p.botao.setAttribute('aria-expanded', 'false');
    marcarAtivo(p, null);
}

/**
 * Liga o campo por delegação em `raiz` (a tela pode redesenhar o campo sem perder os eventos).
 * @param {Element} raiz - elemento que contém o campo
 * @param {(input: HTMLInputElement, valor: string, final: boolean) => void} aoMudar - recebe o
 *   texto do campo a cada tecla (final = false) e, ao escolher uma sugestão ou sair do campo, o
 *   horário normalizado ("14:00" para "14") ou o texto que não deu para entender (final = true).
 */
function ligarCampoHora(raiz, aoMudar) {
    const avisar = (p, final) => {
        if (final) {
            const n = D.normalizarHora(p.input.value);
            if (n) p.input.value = n;
        }
        marcarEscolhido(p, p.input.value);
        aoMudar(p.input, p.input.value.trim(), final);
    };

    function escolher(p, item) {
        if (!item) return;
        p.input.value = item.dataset.hora;
        fechar(p);
        avisar(p, true);
    }

    raiz.addEventListener('input', (ev) => {
        if (!ev.target.matches('[data-hora-campo]')) return;
        const p = partes(ev.target);
        if (!p) return;
        const mascara = D.mascararHora(p.input.value);
        if (mascara !== p.input.value) p.input.value = mascara;
        // Digitar tira o destaque da lista: Enter confirma o que foi digitado, não a sugestão
        if (aberta(p)) {
            marcarAtivo(p, null);
            rolarAte(p, referencia(p), true);
        }
        avisar(p, false);
    });

    raiz.addEventListener('keydown', (ev) => {
        if (!ev.target.matches('[data-hora-campo]')) return;
        const p = partes(ev.target);
        if (!p) return;
        const atual = p.itens.find((x) => x.classList.contains('ativo'));
        const passo = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 }[ev.key];
        if (passo) {
            ev.preventDefault();
            if (!aberta(p) || ev.altKey) return abrir(p, true);
            const i = atual ? p.itens.indexOf(atual) + passo : p.itens.indexOf(referencia(p));
            marcarAtivo(p, p.itens[Math.min(Math.max(i, 0), p.itens.length - 1)]);
        } else if (ev.key === 'Enter') {
            ev.preventDefault();
            if (aberta(p) && atual) escolher(p, atual);
            else {
                fechar(p);
                avisar(p, true);
            }
        } else if (ev.key === 'Escape' && aberta(p)) {
            // Esc fecha só a lista, não o diálogo nem o menu do base.js
            ev.preventDefault();
            ev.stopPropagation();
            fechar(p);
        } else if (ev.key === 'Tab') fechar(p);
    });

    // Clicar na lista ou no botão não tira o foco do campo (senão a lista fecharia antes do clique)
    raiz.addEventListener('mousedown', (ev) => {
        if (ev.target.closest('[data-hora-caixa] [role="listbox"], [data-hora-abrir]'))
            ev.preventDefault();
    });

    raiz.addEventListener('click', (ev) => {
        const p = partes(ev.target);
        if (!p) return;
        if (ev.target.closest('[data-hora-abrir]')) {
            if (aberta(p)) fechar(p);
            else abrir(p, false);
            p.input.focus();
            return;
        }
        const item = ev.target.closest('[role="option"]');
        if (item) return escolher(p, item);
        if (ev.target === p.input && !aberta(p)) abrir(p, false);
    });

    raiz.addEventListener('focusout', (ev) => {
        if (!ev.target.matches('[data-hora-campo]')) return;
        const p = partes(ev.target);
        if (!p || (ev.relatedTarget && p.caixa.contains(ev.relatedTarget))) return;
        fechar(p);
        avisar(p, true);
    });

    // Clicar fora fecha a lista
    document.addEventListener('pointerdown', (ev) => {
        raiz.querySelectorAll('[data-hora-caixa]').forEach((caixa) => {
            if (!caixa.contains(ev.target)) fechar(partes(caixa));
        });
    });
}

export { ligarCampoHora };
