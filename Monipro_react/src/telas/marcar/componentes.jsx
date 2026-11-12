// Porte de Monipro_web/JS/marcar/componentes.js: os pedaços da tela de marcar monitoria
// (calendário, card de vaga, passos, caixa do horário etc.), com o mesmo HTML do original.
// O texto vindo da API entra como texto do JSX, que já escapa (no original: escaparHtml).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as D from './datas.js';

// Ícones de traço no mesmo estilo dos SVGs do header (stroke arredondado, currentColor)
const ICONES = {
    relogio: (
        <>
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
        </>
    ),
    local: (
        <>
            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
        </>
    ),
    pessoas: (
        <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
    ),
    pessoa: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </>
    ),
    inscrito: (
        <>
            <circle cx="9" cy="8" r="4" />
            <path d="M2 20c0-4 3.1-7 7-7s7 3 7 7" />
            <polyline points="16 11 18 13 22 9" />
        </>
    ),
    livro: (
        <>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </>
    ),
    calendario: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </>
    ),
    agendar: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <polyline points="9 16 11 18 15 14" />
        </>
    ),
    criar: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="12" y1="13" x2="12" y2="19" />
            <line x1="9" y1="16" x2="15" y2="16" />
        </>
    ),
    assunto: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    alerta: (
        <>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </>
    ),
    lotada: (
        <>
            <circle cx="12" cy="12" r="9" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </>
    ),
    ok: <polyline points="20 6 9 17 4 12" />,
    olho: (
        <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    esquerda: <polyline points="15 18 9 12 15 6" />,
    direita: <polyline points="9 18 15 12 9 6" />,
    abaixo: <polyline points="6 9 12 15 18 9" />
};

export function Icone({ nome, tamanho = 14, traco = 2 }) {
    return (
        <svg
            className="ico"
            width={tamanho}
            height={tamanho}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={traco}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {ICONES[nome]}
        </svg>
    );
}

/**
 * Calendário do mês. Só um dia fica na ordem do Tab (tabindex=0); as setas movem entre os
 * dias (aoTeclar, tratado na tela).
 * @param {object} props - ano, mes, agora, selecionado, contagem, aceitaDiaVazio, rotuloQtd,
 *   legenda, resumo, como no original; focoDia é o dia em que as setas pararam (ou null);
 *   aoMudarMes(delta), aoEscolherDia(chave, evento) e aoTeclar(evento) são os eventos.
 */
export function Calendario({
    ano,
    mes,
    agora,
    selecionado,
    contagem,
    aceitaDiaVazio,
    rotuloQtd,
    legenda,
    resumo,
    focoDia,
    aoMudarMes,
    aoEscolherDia,
    aoTeclar
}) {
    const primeiro = new Date(ano, mes, 1).getDay();
    const ultimo = new Date(ano, mes + 1, 0).getDate();
    const hoje = D.chave(agora);
    const dias = [];
    for (let d = 1; d <= ultimo; d++) {
        const data = new Date(ano, mes, d);
        const k = D.chave(data);
        const n = contagem[k] || 0;
        const passado = D.diaPassado(data, agora);
        dias.push({
            d,
            k,
            n,
            ativo: n > 0 && !passado,
            fds: data.getDay() === 0 || data.getDay() === 6,
            bloqueado: passado || (!aceitaDiaVazio && n === 0)
        });
    }
    const foco = (
        dias.find((x) => x.k === focoDia && !x.bloqueado) ||
        dias.find((x) => x.k === selecionado && !x.bloqueado) ||
        dias.find((x) => !x.bloqueado) ||
        {}
    ).k;
    const nomeMes = D.MESES[mes][0].toUpperCase() + D.MESES[mes].slice(1);

    return (
        <div className="cal">
            <div className="cal-topo">
                <button
                    type="button"
                    className="nav"
                    data-acao="mes"
                    data-delta="-1"
                    aria-label="Mês anterior"
                    onClick={() => aoMudarMes(-1)}
                >
                    <Icone nome="esquerda" tamanho={18} traco={2.5} />
                </button>
                <h3 aria-live="polite">
                    {/* Um nó de texto só, como no original: dois mudam a largura do título */}
                    {nomeMes + ' '}
                    <span>{ano}</span>
                </h3>
                <button
                    type="button"
                    className="nav"
                    data-acao="mes"
                    data-delta="1"
                    aria-label="Próximo mês"
                    onClick={() => aoMudarMes(1)}
                >
                    <Icone nome="direita" tamanho={18} traco={2.5} />
                </button>
            </div>
            <div
                className="cal-grade"
                role="group"
                aria-label="Dias do mês. Use as setas para mudar de dia."
                onKeyDown={aoTeclar}
            >
                {D.DIAS_SEMANA.map((n) => (
                    <span key={n} className="dw" aria-hidden="true">
                        {n}
                    </span>
                ))}
                {Array.from({ length: primeiro }, (_, i) => (
                    <span key={i}></span>
                ))}
                {dias.map((x) => (
                    // A chave é o dia: ao trocar de mês os botões nascem de novo, sem transição
                    <button
                        key={x.k}
                        type="button"
                        className={
                            'dia' +
                            (x.ativo ? ' tem' : '') +
                            (x.k === hoje ? ' hoje' : '') +
                            (x.fds ? ' fds' : '')
                        }
                        data-acao="dia"
                        data-dia={x.k}
                        tabIndex={x.k === foco ? 0 : -1}
                        aria-pressed={x.k === selecionado}
                        disabled={x.bloqueado}
                        aria-label={
                            x.d +
                            ' de ' +
                            D.MESES[mes] +
                            ', ' +
                            rotuloQtd(x.n) +
                            (x.k === hoje ? ', hoje' : '')
                        }
                        onClick={(ev) => aoEscolherDia(x.k, ev)}
                    >
                        <span>{x.d}</span>
                        <span className="pontos">
                            {x.ativo
                                ? Array.from({ length: Math.min(x.n, 3) }, (_, i) => (
                                      <i key={i}></i>
                                  ))
                                : null}
                        </span>
                    </button>
                ))}
            </div>
            <div className="cal-rodape">
                <span>{resumo}</span>
                <span className="legenda">
                    <span>
                        <i className="amostra amostra-tem"></i>
                        {legenda}
                    </span>
                    <span>
                        <i className="amostra amostra-hoje"></i>Hoje
                    </span>
                </span>
            </div>
        </div>
    );
}

function ChipVaga({ v }) {
    if (v.situacao === 'inscrito')
        return (
            <span className="chip info">
                <Icone nome="inscrito" tamanho={12} />
                Você já está inscrito
            </span>
        );
    if (v.situacao === 'cancelado')
        return (
            <span className="chip neutro">
                <Icone nome="inscrito" tamanho={12} />
                Inscrição cancelada
            </span>
        );
    if (v.livres <= 0)
        return (
            <span className="chip bad">
                <Icone nome="lotada" tamanho={12} />
                Lotada
            </span>
        );
    if (v.livres === 1)
        return (
            <span className="chip warn">
                <Icone nome="alerta" tamanho={12} />
                Último lugar
            </span>
        );
    return (
        <span className="chip ok">
            <Icone nome="pessoas" tamanho={12} />
            {v.livres + ' de ' + v.capacidade + ' livres'}
        </span>
    );
}

function ConteudoVaga({ v }) {
    return (
        <>
            <span className="av" aria-hidden="true">
                {D.iniciais(v.monitor)}
            </span>
            <span className="vaga-info">
                <b>{v.monitor}</b>
                <span className="meta">
                    <span className="h">
                        <Icone nome="relogio" tamanho={13} />
                        {D.hora(v.inicio)}
                    </span>
                    <span>
                        <Icone nome="local" tamanho={13} />
                        {v.local || 'A definir'}
                    </span>
                </span>
                {v.descricao ? (
                    <span className="assunto">
                        <Icone nome="assunto" tamanho={12} />
                        {v.descricao}
                    </span>
                ) : null}
            </span>
            <ChipVaga v={v} />
        </>
    );
}

/** Card de vaga selecionável da lista do aluno. */
export function VagaBotao({ vaga, selecionada, aoEscolher }) {
    return (
        <button
            type="button"
            className="vaga"
            data-acao="vaga"
            data-id={vaga.id}
            aria-pressed={selecionada}
            disabled={Boolean(vaga.situacao) || vaga.livres <= 0}
            onClick={aoEscolher}
        >
            <ConteudoVaga v={vaga} />
        </button>
    );
}

/** O mesmo card, parado: a prévia do monitor. */
export function VagaEstatica({ vaga }) {
    return (
        <div className="vaga">
            <ConteudoVaga v={vaga} />
        </div>
    );
}

/** acao é o data-acao do original ("passo" ou "m-passo"); o clique volta ao passo 1. */
export function DiaSelecionado({ dia, acao, aoTrocar }) {
    return (
        <div className="dia-sel">
            <Icone nome="calendario" tamanho={16} />
            <b>{D.diaLongo(D.deChave(dia))}</b>
            <button
                type="button"
                className="link"
                data-acao={acao}
                data-passo="1"
                onClick={aoTrocar}
            >
                Trocar dia
            </button>
        </div>
    );
}

export function Passos({ nomes, atual }) {
    return (
        <ol className="passos" aria-label="Etapas">
            {nomes.map((nome, i) => (
                <li
                    key={nome}
                    className={i + 1 === atual ? 'on' : i + 1 < atual ? 'feito' : ''}
                    aria-current={i + 1 === atual ? 'step' : undefined}
                >
                    {i + 1 + '. ' + nome}
                </li>
            ))}
        </ol>
    );
}

export function Carregando({ texto }) {
    return (
        <div className="esqueleto" aria-busy="true">
            <span className="sr-only">{texto}</span>
            <i></i>
            <i></i>
            <i></i>
        </div>
    );
}

export function LinhaResumo({ rotulo, icone, valor }) {
    return (
        <>
            <dt>
                <Icone nome={icone} />
                {rotulo}
            </dt>
            <dd>{valor}</dd>
        </>
    );
}

/**
 * Caixa do horário: um botão que abre uma lista curta com rolagem própria (padrão
 * combobox/listbox do WAI-ARIA). Substitui o <input type="time">, que só abria pelo ícone
 * do relógio, e o <select>, cuja lista nativa o navegador estica até o fim da página.
 * @param {object} props
 * @param {string} props.atual - horário escolhido ("HH:MM") ou ''.
 * @param {string[]} props.ocupados - horários em que o monitor já tem vaga no dia.
 * @param {boolean} props.invalido - o campo está com erro à mostra.
 * @param {(hora: string) => void} props.aoEscolher
 * @param {() => void} props.aoSair - o foco saiu do campo (e não foi para a própria lista).
 */
export function CampoHora({ atual, ocupados, invalido, aoEscolher, aoSair }) {
    const [aberta, setAberta] = useState(false);
    // Item realçado pelo teclado (classe "ativo"); como no original, continua marcado ao fechar
    const [ativo, setAtivo] = useState(null);
    const botao = useRef(null);
    const lista = useRef(null);
    const itens = D.horarios(atual);
    const idDe = (h) => 'h-' + h.replace(':', '');

    // Abre centralizada no horário escolhido (ou em 14:00, meio da tarde)
    function abrir() {
        setAtivo(atual || '14:00');
        setAberta(true);
    }

    useLayoutEffect(() => {
        if (!aberta) return;
        const ul = lista.current;
        // Mesmo fallback do original (tela.js): sem item ativo, abre no primeiro horário
        const item = ul.querySelector('.ativo') || ul.firstElementChild;
        if (item) {
            ul.scrollTop = Math.max(
                item.offsetTop - ul.clientHeight / 2 + item.offsetHeight / 2,
                0
            );
        }
        ul.focus({ preventScroll: true });
    }, [aberta]);

    function fechar(devolverFoco) {
        if (!aberta) return;
        setAberta(false);
        if (devolverFoco) botao.current.focus();
    }

    // Marca o item ativo e rola só dentro da lista, sem mexer na página
    function marcarAtivo(i) {
        setAtivo(itens[i]);
        const ul = lista.current;
        const item = ul.children[i];
        const topo = item.offsetTop;
        const fim = topo + item.offsetHeight;
        if (topo < ul.scrollTop) ul.scrollTop = topo - 4;
        else if (fim > ul.scrollTop + ul.clientHeight) ul.scrollTop = fim - ul.clientHeight + 4;
    }

    function escolher(h) {
        aoEscolher(h);
        fechar(true);
    }

    function teclaNoBotao(ev) {
        if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(ev.key)) return;
        ev.preventDefault();
        abrir();
    }

    function teclaNaLista(ev) {
        const mover = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 }[ev.key];
        if (mover) {
            ev.preventDefault();
            marcarAtivo(Math.min(Math.max(itens.indexOf(ativo) + mover, 0), itens.length - 1));
        } else if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            marcarAtivo(ev.key === 'Home' ? 0 : itens.length - 1);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            escolher(ativo);
        } else if (ev.key === 'Escape') {
            // stopPropagation: o Esc fecha só a lista, não o menu/janelas da casca
            ev.preventDefault();
            ev.stopPropagation();
            fechar(true);
        } else if (ev.key === 'Tab') {
            fechar(false);
        }
    }

    // Clicar fora fecha a lista
    useEffect(() => {
        if (!aberta) return;
        const aoApontar = (ev) => {
            if (!ev.target.closest('.hora')) setAberta(false);
        };
        document.addEventListener('pointerdown', aoApontar);
        return () => document.removeEventListener('pointerdown', aoApontar);
    }, [aberta]);

    return (
        <div className="hora">
            <button
                ref={botao}
                type="button"
                id="f-hora"
                className="hora-btn"
                aria-haspopup="listbox"
                aria-expanded={aberta}
                aria-controls="lista-hora"
                aria-describedby="d-hora"
                aria-invalid={invalido ? 'true' : undefined}
                onClick={() => (aberta ? fechar(true) : abrir())}
                onKeyDown={teclaNoBotao}
                onBlur={(ev) => {
                    // Abrir a lista move o foco do botão para a lista: ainda não é "sair do campo"
                    if (ev.relatedTarget && ev.relatedTarget.closest('.hora')) return;
                    aoSair();
                }}
            >
                <Icone nome="relogio" tamanho={16} />
                <span className={atual ? 'valor' : 'valor sem-valor'}>{atual || 'Escolher'}</span>
                <span className="seta">
                    <Icone nome="abaixo" tamanho={16} traco={2.5} />
                </span>
            </button>
            <ul
                ref={lista}
                className="hora-lista"
                id="lista-hora"
                role="listbox"
                aria-label="Horários"
                aria-activedescendant={aberta && ativo ? idDe(ativo) : undefined}
                tabIndex={-1}
                hidden={!aberta}
                onKeyDown={teclaNaLista}
            >
                {itens.map((h) => (
                    <li
                        key={h}
                        role="option"
                        id={idDe(h)}
                        className={h === ativo ? 'ativo' : undefined}
                        data-hora={h}
                        aria-selected={h === atual}
                        onClick={() => escolher(h)}
                    >
                        {h}
                        {ocupados.includes(h) ? (
                            <span className="tag-ocupado">já tem vaga</span>
                        ) : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}
