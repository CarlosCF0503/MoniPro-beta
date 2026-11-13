// "Finalizar monitoria" do perfil do monitor (porte do #dlg-finalizar de perfil_monitor.html e
// do trecho de JS/perfil/monitor.js). O término fica numa caixa clicável com lista curta
// (combobox/listbox), como em Marcar Monitoria, mais os atalhos 1h, 1h30 e 2h.
//
// ref.current.abrir(vaga): prepara e abre o diálogo.
// aoFinalizar(vaga, fim, minutos): a API aceitou; o diálogo já fechou.
import { useImperativeHandle, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { chamadaApi, mensagemDaApi } from '../../api.js';
import { useCasca } from '../../Casca.jsx';
import * as D from '../../perfil/dados.js';

const ATALHOS = [
    [60, '1h'],
    [90, '1h30'],
    [120, '2h']
];

export function DialogoFinalizar({ ref, className, aoFinalizar, sessaoExpirada, aoFechar }) {
    const { showToast } = useCasca();
    const dlg = useRef(null);
    const botao = useRef(null);
    const lista = useRef(null);
    const [vaga, setVaga] = useState(null);
    const [minutos, setMinutos] = useState(null); // término escolhido, em minutos depois do início
    const [aberta, setAberta] = useState(false);
    const [paraCima, setParaCima] = useState(false);
    const [ativo, setAtivo] = useState(null); // item realçado pelo teclado (classe "ativo")
    const [invalido, setInvalido] = useState(false);
    const [erro, setErro] = useState('');
    const [finalizando, setFinalizando] = useState(false);
    // Trava síncrona contra envio duplo (o original desativa o botão na hora)
    const enviando = useRef(false);

    const opcoes = vaga ? D.opcoesTermino(vaga.inicio) : [];

    useImperativeHandle(
        ref,
        () => ({
            abrir(v) {
                flushSync(() => {
                    setVaga(v);
                    setMinutos(null);
                    setAberta(false);
                    setAtivo(null); // o original refaz a lista a cada abertura
                    setInvalido(false);
                    setErro('');
                    setFinalizando(false);
                });
                // O original reativa o botão a cada abertura: um envio de outra vaga, ainda
                // pendente, não bloqueia este
                enviando.current = false;
                dlg.current.showModal();
                botao.current.focus();
            }
        }),
        []
    );

    function escolher(m) {
        setMinutos(m);
        setInvalido(false);
        setErro('');
    }

    // Marca o item ativo e rola só dentro da lista, sem mexer na página
    function marcarAtivo(i) {
        setAtivo(opcoes[i].minutos);
        const ul = lista.current;
        const item = ul.children[i];
        const topo = item.offsetTop;
        const base = topo + item.offsetHeight;
        if (topo < ul.scrollTop) ul.scrollTop = topo - 4;
        else if (base > ul.scrollTop + ul.clientHeight) ul.scrollTop = base - ul.clientHeight + 4;
    }

    function abrirLista() {
        // Abre centralizada no término escolhido (ou em 1h, o caso mais comum)
        const tem = (m) => opcoes.some((o) => o.minutos === m);
        const inicial =
            minutos !== null && tem(minutos) ? minutos : tem(60) ? 60 : opcoes[0].minutos;
        flushSync(() => {
            setAberta(true);
            setParaCima(false);
            setAtivo(inicial);
        });
        const ul = lista.current;
        // Abre para cima quando não cabe abaixo da caixa (painel no rodapé do celular)
        const r = botao.current.getBoundingClientRect();
        const abaixo = window.innerHeight - r.bottom;
        if (abaixo < ul.offsetHeight + 8 && r.top > abaixo) flushSync(() => setParaCima(true));
        const item = ul.children[opcoes.findIndex((o) => o.minutos === inicial)];
        ul.scrollTop = Math.max(item.offsetTop - ul.clientHeight / 2 + item.offsetHeight / 2, 0);
        ul.focus({ preventScroll: true });
    }

    function fecharLista(devolverFoco) {
        if (!aberta) return;
        setAberta(false);
        if (devolverFoco) botao.current.focus();
    }

    function teclaNoBotao(ev) {
        if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(ev.key)) return;
        ev.preventDefault();
        abrirLista();
    }

    function teclaNaLista(ev) {
        const i = opcoes.findIndex((o) => o.minutos === ativo);
        const mover = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 }[ev.key];
        if (mover) {
            ev.preventDefault();
            marcarAtivo(Math.min(Math.max(i + mover, 0), opcoes.length - 1));
        } else if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            marcarAtivo(ev.key === 'Home' ? 0 : opcoes.length - 1);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            if (i >= 0) {
                escolher(ativo);
                fecharLista(true);
            }
        } else if (ev.key === 'Escape') {
            // Esc fecha só a lista, não o diálogo nem o menu da casca
            ev.preventDefault();
            ev.stopPropagation();
            fecharLista(true);
        } else if (ev.key === 'Tab') {
            fecharLista(false);
        }
    }

    async function enviar(ev) {
        ev.preventDefault();
        if (!vaga || enviando.current) return;
        if (minutos === null) {
            setErro('Escolha o horário de término.');
            setInvalido(true);
            botao.current.focus();
            return;
        }
        const fim = new Date(vaga.inicio.getTime() + minutos * 60000);
        enviando.current = true;
        setFinalizando(true);
        try {
            const dados = await chamadaApi('/monitorias/' + vaga.id + '/finalizar', {
                method: 'PATCH',
                body: JSON.stringify({ data_fim: fim.toISOString() })
            });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (dados.erro || !dados.success) {
                setErro(mensagemDaApi(dados, 'Não foi possível finalizar a monitoria.'));
                return;
            }
            dlg.current.close();
            aoFinalizar(vaga, fim);
            showToast('Monitoria finalizada · ' + D.duracao(minutos) + ' registradas.', 'success');
        } catch (erro) {
            setErro('Erro de rede. Verifique a conexão e tente de novo.');
            console.error('[MoniPro] Erro de rede ao finalizar a monitoria.', erro);
        } finally {
            enviando.current = false;
            setFinalizando(false);
        }
    }

    const fimTexto =
        vaga && minutos !== null ? D.hora(new Date(vaga.inicio.getTime() + minutos * 60000)) : null;

    return (
        <dialog
            ref={dlg}
            className={className}
            id="dlg-finalizar"
            aria-labelledby="fin-titulo"
            onPointerDown={(ev) => {
                if (!ev.target.closest('.hora')) fecharLista(false);
            }}
            onClose={() => {
                setAberta(false);
                aoFechar();
            }}
        >
            <form method="dialog" id="fin-form" noValidate onSubmit={enviar}>
                <div>
                    <h2 id="fin-titulo">Finalizar monitoria</h2>
                    <p className="pp-sub" id="fin-sub">
                        {vaga ? vaga.disciplina + ' · ' + D.diaCurto(vaga.inicio) : ''}
                    </p>
                </div>
                <div className="pp-campo">
                    <span className="pp-rotulo">Início</span>
                    <div className="pp-leitura" id="fin-inicio">
                        {vaga
                            ? vaga.inicio.toLocaleDateString('pt-BR') + ' às ' + D.hora(vaga.inicio)
                            : ''}
                    </div>
                </div>
                <div className="pp-campo">
                    <span className="pp-rotulo" id="fin-fim-rotulo">
                        Horário de término
                    </span>
                    <div className="hora">
                        <button
                            ref={botao}
                            type="button"
                            id="fin-fim"
                            className="hora-btn"
                            aria-haspopup="listbox"
                            aria-expanded={aberta}
                            aria-controls="fin-lista"
                            aria-labelledby="fin-fim-rotulo fin-fim-valor"
                            aria-describedby="fin-erro fin-duracao"
                            aria-invalid={invalido ? 'true' : undefined}
                            onClick={() => (aberta ? fecharLista(true) : abrirLista())}
                            onKeyDown={teclaNoBotao}
                        >
                            <svg
                                className="ico"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="9" />
                                <polyline points="12 7 12 12 15 14" />
                            </svg>
                            <span
                                className={fimTexto ? 'valor' : 'valor sem-valor'}
                                id="fin-fim-valor"
                            >
                                {fimTexto || 'Escolher'}
                            </span>
                            <span className="seta">
                                <svg
                                    className="ico"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </span>
                        </button>
                        <ul
                            ref={lista}
                            className={paraCima ? 'hora-lista para-cima' : 'hora-lista'}
                            id="fin-lista"
                            role="listbox"
                            aria-labelledby="fin-fim-rotulo"
                            aria-activedescendant={
                                aberta && ativo !== null ? 'fim-' + ativo : undefined
                            }
                            tabIndex={-1}
                            hidden={!aberta}
                            onKeyDown={teclaNaLista}
                        >
                            {opcoes.map((o) => (
                                <li
                                    key={o.minutos}
                                    role="option"
                                    id={'fim-' + o.minutos}
                                    className={o.minutos === ativo ? 'ativo' : undefined}
                                    data-minutos={o.minutos}
                                    aria-selected={o.minutos === minutos}
                                    onClick={() => {
                                        escolher(o.minutos);
                                        fecharLista(true);
                                    }}
                                >
                                    {o.hora}
                                    <span className="tag-dur">{D.duracao(o.minutos)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="pp-atalhos" role="group" aria-label="Durações comuns">
                        {ATALHOS.map(([m, t]) => (
                            <button
                                key={m}
                                type="button"
                                data-minutos={m}
                                onClick={() => {
                                    escolher(m);
                                    fecharLista(false);
                                }}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <p className="pp-duracao" id="fin-duracao">
                        {minutos === null ? (
                            'Escolha o término para ver a duração.'
                        ) : (
                            <>
                                {'Duração: '}
                                <strong>{D.duracao(minutos)}</strong>
                            </>
                        )}
                    </p>
                    <p className="pp-erro" id="fin-erro" role="alert">
                        {erro}
                    </p>
                </div>
                <div className="pp-acoes">
                    <button
                        type="button"
                        className="pp-btn pp-btn-sec"
                        data-fechar=""
                        onClick={() => dlg.current.close()}
                    >
                        Voltar
                    </button>
                    <button
                        type="submit"
                        className="pp-btn pp-btn-pri"
                        id="fin-confirmar"
                        disabled={finalizando}
                    >
                        {finalizando ? 'Finalizando…' : 'Finalizar monitoria'}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
