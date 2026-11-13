// "Editar vaga" do perfil do monitor (RF-009, RN-010; porte do #dlg-editar de
// perfil_monitor.html e do trecho de JS/perfil/monitor.js). PATCH /monitorias/:id.
// Dia e horário só mudam até 24h antes; local, lugares e assunto, até o início. Lugares nunca
// abaixo do número de inscritos. Se dia, horário ou local mudarem, os inscritos podem cancelar
// sem a regra das 24h.
// O dia tem calendário próprio e o horário uma lista curta: os dois abrem pelo campo inteiro.
// Como no original, não reaproveita os de Marcar Monitoria (marcação e classes diferentes).
//
// ref.current.abrir(vaga, agora): prepara e abre o diálogo.
// aoSalvar(id, mudanca): a API aceitou; o diálogo já fechou.
import { useImperativeHandle, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { chamadaApi, mensagemDaApi } from '../../api.js';
import { useCasca } from '../../Casca.jsx';
import * as D from '../../perfil/dados.js';

// Mesmos horários da criação: das 07:00 às 22:00, de 15 em 15 min. O horário atual da vaga
// entra na lista mesmo fora desse passo.
const HORA_INICIO = 7 * 60;
const HORA_FIM = 22 * 60;
const HORA_PASSO = 15;
const pad = (n) => String(n).padStart(2, '0');

function horariosDaLista(atual) {
    const lista = [];
    for (let m = HORA_INICIO; m <= HORA_FIM; m += HORA_PASSO)
        lista.push(pad(Math.floor(m / 60)) + ':' + pad(m % 60));
    if (atual && !lista.includes(atual)) lista.push(atual);
    return lista.sort((a, b) => a.localeCompare(b));
}

const isoDia = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const meiaNoite = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function deIso(k) {
    const [a, m, d] = k.split('-').map(Number);
    return new Date(a, m - 1, d);
}

function Seta() {
    return (
        <svg
            className="seta"
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
    );
}

function SetaMes({ pontos }) {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points={pontos} />
        </svg>
    );
}

/** Grade do mês: dias passados bloqueados, hoje marcado; só o dia em foco entra no Tab. */
function Calendario({ mes, foco, escolhido, aoMudarMes, aoEscolher }) {
    const hoje = meiaNoite(new Date());
    const kHoje = isoDia(hoje);
    const kFoco = isoDia(foco);
    const ano = mes.getFullYear();
    const m = mes.getMonth();
    const vazios = new Date(ano, m, 1).getDay();
    const ultimo = new Date(ano, m + 1, 0).getDate();
    const dias = [];
    for (let n = 1; n <= ultimo; n++) {
        const data = new Date(ano, m, n);
        const k = isoDia(data);
        dias.push(
            <button
                key={k}
                type="button"
                className={k === kHoje ? 'cal-dia hoje' : 'cal-dia'}
                data-dia={k}
                tabIndex={k === kFoco ? 0 : -1}
                aria-pressed={k === escolhido}
                aria-label={n + ' de ' + D.MESES[m] + (k === kHoje ? ', hoje' : '')}
                disabled={data < hoje}
                onClick={() => aoEscolher(k)}
            >
                {n}
            </button>
        );
    }
    const voltarBloqueado = ano === hoje.getFullYear() && m === hoje.getMonth();
    return (
        <>
            <div className="cal-topo">
                <button
                    type="button"
                    className="cal-nav"
                    data-mes="-1"
                    aria-label="Mês anterior"
                    disabled={voltarBloqueado}
                    onClick={() => aoMudarMes(-1)}
                >
                    <SetaMes pontos="15 18 9 12 15 6" />
                </button>
                <strong aria-live="polite">{D.MESES[m] + ' ' + ano}</strong>
                <button
                    type="button"
                    className="cal-nav"
                    data-mes="1"
                    aria-label="Próximo mês"
                    onClick={() => aoMudarMes(1)}
                >
                    <SetaMes pontos="9 18 15 12 9 6" />
                </button>
            </div>
            <div className="cal-grade">
                {D.DIAS_SEMANA.map((n) => (
                    <span key={n} className="cal-dw" aria-hidden="true">
                        {n}
                    </span>
                ))}
                {Array.from({ length: vazios }, (_, i) => (
                    <span key={'v' + i}></span>
                ))}
                {dias}
            </div>
        </>
    );
}

export function DialogoEditar({ ref, className, aoSalvar }) {
    const { showToast } = useCasca();
    const dlg = useRef(null);
    const diaBtn = useRef(null);
    const horaBtn = useRef(null);
    const horaLista = useRef(null);
    const calRef = useRef(null);
    const localRef = useRef(null);
    const capRef = useRef(null);

    const [vaga, setVaga] = useState(null);
    const [perto, setPerto] = useState(false); // menos de 24h: dia e horário travados
    const [dia, setDia] = useState(''); // "AAAA-MM-DD"
    const [hora, setHora] = useState(''); // "HH:MM"
    const [local, setLocal] = useState('');
    const [cap, setCap] = useState('');
    const [desc, setDesc] = useState('');
    const [erro, setErro] = useState('');
    const [invalido, setInvalido] = useState(null); // 'hora' | 'local' | 'cap'
    const [salvando, setSalvando] = useState(false);
    const [horaAberta, setHoraAberta] = useState(false);
    const [horaAtiva, setHoraAtiva] = useState(null);
    // O calendário guarda o último mês desenhado mesmo fechado, como o original
    const [calAberto, setCalAberto] = useState(false);
    const [cal, setCal] = useState(null); // { mes, foco }
    // Trava síncrona contra envio duplo (o original desativa o botão na hora)
    const enviando = useRef(false);

    const horas = horariosDaLista(hora);

    useImperativeHandle(
        ref,
        () => ({
            abrir(v, agora) {
                // O estado entra antes do showModal: com dia e horário travados, o foco inicial
                // do diálogo cai no Local, como no original
                flushSync(() => {
                    setVaga(v);
                    setPerto(v.inicio - agora < D.HORAS_CANCELAMENTO * 3600e3);
                    setDia(isoDia(meiaNoite(v.inicio)));
                    setHora(D.hora(v.inicio));
                    setLocal(v.local);
                    setCap(String(v.capacidade));
                    setDesc(v.descricao || '');
                    setErro('');
                    setInvalido(null);
                });
                dlg.current.showModal();
            }
        }),
        []
    );

    // --- Horário: lista curta (combobox/listbox do WAI-ARIA), como em "Abrir nova vaga" ---
    function marcarHoraAtiva(i) {
        setHoraAtiva(horas[i]);
        const ul = horaLista.current;
        const item = ul.children[i];
        const topo = item.offsetTop;
        const fim = topo + item.offsetHeight;
        if (topo < ul.scrollTop) ul.scrollTop = topo - 4;
        else if (fim > ul.scrollTop + ul.clientHeight) ul.scrollTop = fim - ul.clientHeight + 4;
    }
    function abrirHora() {
        if (perto) return;
        const i = Math.max(horas.indexOf(hora), 0);
        flushSync(() => {
            setHoraAberta(true);
            setHoraAtiva(horas[i]);
        });
        const ul = horaLista.current;
        const item = ul.children[i];
        ul.scrollTop = Math.max(item.offsetTop - ul.clientHeight / 2 + item.offsetHeight / 2, 0);
        ul.focus({ preventScroll: true });
    }
    function fecharHora(devolverFoco) {
        if (!horaAberta) return;
        setHoraAberta(false);
        if (devolverFoco) horaBtn.current.focus();
    }
    function escolherHora(h) {
        if (!h) return;
        setHora(h);
        if (invalido === 'hora') setInvalido(null);
        fecharHora(true);
    }
    function teclaNaHora(ev) {
        const i = horas.indexOf(horaAtiva);
        const mover = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 }[ev.key];
        if (mover) {
            ev.preventDefault();
            marcarHoraAtiva(Math.min(Math.max(i + mover, 0), horas.length - 1));
        } else if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            marcarHoraAtiva(ev.key === 'Home' ? 0 : horas.length - 1);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            escolherHora(i >= 0 ? horaAtiva : null);
        } else if (ev.key === 'Escape') {
            // Esc fecha só a lista, não o diálogo
            ev.preventDefault();
            ev.stopPropagation();
            fecharHora(true);
        } else if (ev.key === 'Tab') {
            fecharHora(false);
        }
    }

    // --- Dia: calendário do mês dentro do diálogo ---
    // Setas andam de um dia (←/→) ou de uma semana (↑/↓), Page Up/Down trocam de mês, Enter
    // escolhe e Esc fecha só o calendário.
    function focarDia(data, focar, abrir) {
        const hoje = meiaNoite(new Date());
        const foco = data < hoje ? hoje : data;
        flushSync(() => {
            if (abrir) {
                setHoraAberta(false);
                setCalAberto(true);
            }
            setCal({ mes: new Date(foco.getFullYear(), foco.getMonth(), 1), foco });
        });
        if (focar) calRef.current.querySelector('[data-dia="' + isoDia(foco) + '"]').focus();
    }
    function abrirCal() {
        if (perto) return;
        focarDia(deIso(dia), true, true);
    }
    function fecharCal(devolverFoco) {
        if (!calAberto) return;
        setCalAberto(false);
        if (devolverFoco) diaBtn.current.focus();
    }
    function teclaNoCal(ev) {
        if (ev.key === 'Escape') {
            // Esc fecha só o calendário, não o diálogo
            ev.preventDefault();
            ev.stopPropagation();
            fecharCal(true);
            return;
        }
        if (!ev.target.closest('[data-dia]')) return;
        const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
        if (passo) {
            ev.preventDefault();
            const alvo = new Date(cal.foco);
            alvo.setDate(alvo.getDate() + passo);
            focarDia(alvo, true);
        } else if (ev.key === 'PageUp' || ev.key === 'PageDown') {
            ev.preventDefault();
            const alvo = new Date(cal.foco);
            alvo.setMonth(alvo.getMonth() + (ev.key === 'PageUp' ? -1 : 1));
            focarDia(alvo, true);
        }
    }

    // --- Mudanças e aviso aos inscritos ---
    const novo = new Date(dia + 'T' + hora);
    // Por minuto: os segundos do horário gravado não contam como mudança
    const mudouQuando =
        Boolean(vaga) &&
        !isNaN(novo) &&
        Math.floor(novo / 60000) !== Math.floor(vaga.inicio / 60000);
    const mudouLocal = Boolean(vaga) && local.trim() !== vaga.local;
    let aviso = '';
    if ((mudouQuando || mudouLocal) && vaga.inscritos)
        aviso =
            (vaga.inscritos === 1
                ? 'O aluno inscrito vê a mudança no perfil e pode'
                : 'Os ' + vaga.inscritos + ' alunos inscritos veem a mudança no perfil e podem') +
            ' cancelar sem a regra das 24h.';
    else if (mudouQuando || mudouLocal) aviso = 'Ninguém se inscreveu ainda.';

    const minimo = vaga ? Math.max(1, vaga.inscritos || 0) : 1;

    async function enviar(ev) {
        ev.preventDefault();
        const v = vaga;
        if (!v || enviando.current) return;
        const n = Number(cap);
        const falhar = (campo, texto) => {
            setErro(texto);
            setInvalido(campo);
            ({ hora: horaBtn, local: localRef, cap: capRef })[campo].current.focus();
        };
        setInvalido(null);
        if (mudouQuando && novo <= new Date())
            return falhar('hora', 'Escolha um dia e horário que ainda não passaram.');
        if (!local.trim()) return falhar('local', 'Informe onde a monitoria acontece.');
        if (!Number.isInteger(n) || n < minimo)
            return falhar('cap', 'Lugares não pode ficar abaixo de ' + minimo + '.');
        enviando.current = true;
        setSalvando(true);
        // Como no original, sem try/catch: um erro de rede deixa o botão em "Salvando…"
        const r = await chamadaApi('/monitorias/' + v.id, {
            method: 'PATCH',
            body: JSON.stringify(
                Object.assign(mudouQuando ? { horario: novo.toISOString() } : {}, {
                    local: local.trim(),
                    capacidade: n,
                    descricao: desc.trim()
                })
            )
        });
        enviando.current = false;
        setSalvando(false);
        if (!r.success) return setErro(mensagemDaApi(r, 'Não foi possível salvar a vaga.'));
        dlg.current.close();
        showToast(
            r.liberados
                ? 'Vaga atualizada. Os inscritos podem cancelar sem a regra das 24h.'
                : 'Vaga atualizada.',
            'success'
        );
        aoSalvar(v.id, {
            ...(mudouQuando ? { inicio: novo } : {}),
            local: local.trim(),
            capacidade: n,
            descricao: desc.trim()
        });
    }

    return (
        <dialog
            ref={dlg}
            className={className}
            id="dlg-editar"
            aria-labelledby="ed-titulo"
            onPointerDown={(ev) => {
                // Clicar fora da lista ou do calendário (dentro do diálogo) fecha cada um
                if (!ev.target.closest('.pp-hora')) fecharHora(false);
                if (!ev.target.closest('#ed-cal, #ed-data')) fecharCal(false);
            }}
            onClose={() => {
                setHoraAberta(false);
                setCalAberto(false);
            }}
        >
            <form method="dialog" id="ed-form" noValidate onSubmit={enviar}>
                <div>
                    <h2 id="ed-titulo">Editar vaga</h2>
                    <p className="pp-sub" id="ed-sub">
                        {vaga
                            ? vaga.disciplina +
                              ' · ' +
                              D.diaCurto(vaga.inicio) +
                              ' às ' +
                              D.hora(vaga.inicio)
                            : ''}
                    </p>
                </div>
                <div className="pp-dois">
                    <div className="pp-campo">
                        <label className="pp-rotulo" htmlFor="ed-data">
                            Dia
                        </label>
                        {/* Calendário próprio: o do navegador muda de cara em cada um e nem sempre abre */}
                        <button
                            ref={diaBtn}
                            type="button"
                            className="pp-input pp-hora-btn"
                            id="ed-data"
                            data-valor={dia || undefined}
                            aria-haspopup="true"
                            aria-expanded={calAberto}
                            aria-controls="ed-cal"
                            disabled={perto}
                            onClick={() => (calAberto ? fecharCal(true) : abrirCal())}
                        >
                            <span className="valor">{dia ? D.diaCurto(deIso(dia)) : ''}</span>
                            <Seta />
                        </button>
                    </div>
                    <div className="pp-campo">
                        <label className="pp-rotulo" htmlFor="ed-hora">
                            Horário
                        </label>
                        <div className="pp-hora">
                            <button
                                ref={horaBtn}
                                type="button"
                                className="pp-input pp-hora-btn"
                                id="ed-hora"
                                data-valor={hora || undefined}
                                aria-haspopup="listbox"
                                aria-expanded={horaAberta}
                                aria-controls="ed-hora-lista"
                                aria-invalid={invalido === 'hora' ? 'true' : undefined}
                                disabled={perto}
                                onClick={() => {
                                    if (horaAberta) fecharHora(true);
                                    else abrirHora();
                                    fecharCal(false);
                                }}
                                onKeyDown={(ev) => {
                                    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
                                    ev.preventDefault();
                                    abrirHora();
                                }}
                            >
                                <span className="valor">{hora}</span>
                                <Seta />
                            </button>
                            <ul
                                ref={horaLista}
                                className="pp-hora-lista"
                                id="ed-hora-lista"
                                role="listbox"
                                aria-label="Horários"
                                aria-activedescendant={
                                    horaAberta && horaAtiva
                                        ? 'ed-h-' + horaAtiva.replace(':', '')
                                        : undefined
                                }
                                tabIndex={-1}
                                hidden={!horaAberta}
                                onKeyDown={teclaNaHora}
                            >
                                {horas.map((h) => (
                                    <li
                                        key={h}
                                        role="option"
                                        id={'ed-h-' + h.replace(':', '')}
                                        className={
                                            horaAberta && h === horaAtiva ? 'ativo' : undefined
                                        }
                                        data-hora={h}
                                        aria-selected={h === hora}
                                        onClick={() => escolherHora(h)}
                                    >
                                        {h}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div
                        ref={calRef}
                        className="pp-cal"
                        id="ed-cal"
                        role="group"
                        aria-label="Escolher o dia"
                        hidden={!calAberto}
                        onKeyDown={teclaNoCal}
                    >
                        {cal ? (
                            <Calendario
                                mes={cal.mes}
                                foco={cal.foco}
                                escolhido={dia}
                                aoMudarMes={(passo) =>
                                    focarDia(
                                        new Date(
                                            cal.mes.getFullYear(),
                                            cal.mes.getMonth() + passo,
                                            1
                                        ),
                                        false
                                    )
                                }
                                aoEscolher={(k) => {
                                    setDia(k);
                                    fecharCal(true);
                                }}
                            />
                        ) : null}
                    </div>
                </div>
                <p className="pp-dica-campo" id="ed-nota-24h" hidden={!perto}>
                    Faltam menos de 24h: dia e horário não mudam mais. Local, lugares e assunto
                    ainda podem mudar.
                </p>
                <div className="pp-campo">
                    <label className="pp-rotulo" htmlFor="ed-local">
                        Local
                    </label>
                    <input
                        ref={localRef}
                        className="pp-input"
                        type="text"
                        id="ed-local"
                        name="ed-local"
                        maxLength={120}
                        autoComplete="off"
                        aria-invalid={invalido === 'local' ? 'true' : undefined}
                        value={local}
                        onChange={(ev) => setLocal(ev.target.value)}
                    />
                </div>
                <div className="pp-campo">
                    <label className="pp-rotulo" htmlFor="ed-cap">
                        Lugares
                    </label>
                    <input
                        ref={capRef}
                        className="pp-input"
                        type="number"
                        id="ed-cap"
                        name="ed-cap"
                        min={minimo}
                        step="1"
                        inputMode="numeric"
                        aria-describedby="ed-cap-dica"
                        aria-invalid={invalido === 'cap' ? 'true' : undefined}
                        value={cap}
                        onChange={(ev) => setCap(ev.target.value)}
                    />
                    <span className="pp-dica-campo" id="ed-cap-dica">
                        {!vaga
                            ? ''
                            : vaga.inscritos
                              ? 'Mínimo ' +
                                vaga.inscritos +
                                ': já há ' +
                                D.plural(vaga.inscritos, 'inscrito', 'inscritos') +
                                '.'
                              : 'Ninguém inscrito ainda.'}
                    </span>
                </div>
                <div className="pp-campo">
                    <label className="pp-rotulo" htmlFor="ed-desc">
                        Assunto (opcional)
                    </label>
                    <textarea
                        className="pp-input"
                        id="ed-desc"
                        name="ed-desc"
                        rows={2}
                        maxLength={500}
                        placeholder="Ex.: Lista 3, integrais"
                        value={desc}
                        onChange={(ev) => setDesc(ev.target.value)}
                    ></textarea>
                </div>
                <p className="pp-info" id="ed-aviso" hidden={!aviso}>
                    {aviso}
                </p>
                <p className="pp-erro" id="ed-erro" role="alert">
                    {erro}
                </p>
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
                        id="ed-salvar"
                        disabled={salvando}
                    >
                        {salvando ? 'Salvando…' : 'Salvar alterações'}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
