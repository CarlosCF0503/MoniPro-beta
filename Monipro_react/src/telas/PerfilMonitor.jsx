// Perfil do monitor: porte de Monipro_web/perfil_monitor.html + JS/perfil/monitor.js.
// - >= 700px (opção A): dados e certificados numa coluna lateral; vagas em três abas
//   (Para finalizar, Próximas, Histórico) com contagem.
// - < 700px (opção C): abas no rodapé (Vagas, Horas, Perfil); Vagas tem o filtro
//   "Em aberto / Histórico" e os detalhes abrem num painel que sobe do rodapé.
// P2 (R4): o monitor confirma a presença dos inscritos depois do início da sessão.
// RF-009 / RN-010: o monitor edita a vaga (src/telas/monitor/DialogoEditar.jsx).
// Cabeçalho, menu lateral, aviso de sair e toast vêm da Casca. O que os dois perfis dividem
// (funções de dados e "Excluir minha conta") fica em src/perfil/.
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
// Mesmos arquivos e mesma ordem dos <link> do perfil_monitor.html original (o base.css vem da
// Casca)
import '../../../Monipro_web/CSS/fontes.css';
import Casca, { useCasca } from '../Casca.jsx';
import '../../../Monipro_web/CSS/perfil_monitor.css';
import { chamadaApi, mensagemDaApi, obterSessao } from '../api.js';
import * as D from '../perfil/dados.js';
import { BlocoPrivacidade, DialogoExcluirConta } from '../perfil/ExcluirConta.jsx';
import { DialogoEditar } from './monitor/DialogoEditar.jsx';
import { DialogoFinalizar } from './monitor/DialogoFinalizar.jsx';

const LIMITE = 100; // máximo aceito por utils/paginacao.js
const celularMq = window.matchMedia('(max-width: 699px)');

// --- Ícones (traço arredondado, currentColor, como no header) ---
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
    calendario: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </>
    ),
    mais: (
        <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </>
    ),
    ok: <polyline points="20 6 9 17 4 12" />,
    x: (
        <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </>
    ),
    medalha: (
        <>
            <circle cx="12" cy="8" r="6" />
            <path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" />
        </>
    ),
    moeda: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v10M9.5 10h5M9.5 14h5" />
        </>
    ),
    email: (
        <>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </>
    ),
    matricula: (
        <>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <circle cx="9" cy="12" r="2.5" />
            <path d="M14 10h4M14 14h4" />
        </>
    ),
    direita: <polyline points="9 18 15 12 9 6" />,
    esquerda: <polyline points="15 18 9 12 15 6" />,
    semRede: (
        <>
            <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
        </>
    )
};

function Icone({ nome, tamanho = 14 }) {
    return (
        <svg
            className="ico"
            width={tamanho}
            height={tamanho}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {ICONES[nome]}
        </svg>
    );
}

// --- Peças que não dependem do estado da tela ---
const AVISO_24H = 'Cancelamento só até ' + D.HORAS_CANCELAMENTO + 'h antes';
const ABAS_CEL = [
    ['vagas', 'Vagas', 'calendario'],
    ['horas', 'Horas', 'relogio'],
    ['perfil', 'Perfil', 'pessoa']
];
const ORDEM_ABAS = ['finalizar', 'proximas', 'historico'];
const ROTULOS_NUMEROS = ['Para finalizar', 'Próximas vagas', 'Horas comprovadas'];
const DICAS = {
    finalizar: 'Vagas cujo horário já passou. Finalize para registrar as horas.',
    proximas: 'Em ordem de data, da mais próxima para a mais distante.',
    historico: 'Vagas realizadas e canceladas, da mais recente para a mais antiga.'
};
const VAZIOS = {
    finalizar: 'Tudo em dia. Nenhuma vaga esperando finalização.',
    proximas: 'Nenhuma vaga marcada. Abra uma para os alunos poderem se inscrever.',
    historico: 'Vagas finalizadas e canceladas aparecem aqui.'
};

const lotada = (v) => v.inscritos !== null && v.inscritos >= v.capacidade;
const quando = (v) => (v.fim ? D.hora(v.inicio) + '–' + D.hora(v.fim) : D.hora(v.inicio));
const duracaoDa = (v) => (v.fim ? ' · ' + D.duracao((v.fim - v.inicio) / 60000) : '');

// curto: na linha do celular, vaga cheia vira só "Lotada" (no computador a etiqueta já diz isso)
function textoInscritos(v, curto) {
    if (v.inscritos === null) return 'Até ' + D.plural(v.capacidade, 'aluno', 'alunos');
    if (curto && v.inscritos >= v.capacidade) return 'Lotada';
    return v.inscritos + ' de ' + v.capacidade + ' inscritos';
}

function BarraInscritos({ v }) {
    if (v.inscritos === null) return null;
    const pct = Math.min(100, Math.round((v.inscritos / v.capacidade) * 100));
    return (
        <span className="cap-barra" aria-hidden="true">
            <i style={{ width: pct + '%' }}></i>
        </span>
    );
}

function Etiqueta({ v, agora }) {
    let classe, ico, texto;
    if (D.grupo(v, agora) === 'finalizar')
        [classe, ico, texto] = ['pill-atencao', 'relogio', 'Aguardando finalização'];
    else if (D.realizada(v)) [classe, ico, texto] = ['pill-ok', 'ok', 'Realizada' + duracaoDa(v)];
    else if (v.status === 'cancelada') [classe, ico, texto] = ['pill-perigo', 'x', 'Cancelada'];
    else if (lotada(v)) [classe, ico, texto] = ['pill-ok', 'pessoas', 'Lotada'];
    else [classe, ico, texto] = ['pill-aberta', 'calendario', 'Aberta'];
    return (
        <span className={'pill ' + classe}>
            <Icone nome={ico} tamanho={12} />
            {texto}
        </span>
    );
}

function ChipPontos({ pontos }) {
    return (
        <span className="chip chip-pontos" title="Pontos de gamificação">
            <Icone nome="moeda" tamanho={14} />
            {pontos + ' pontos'}
        </span>
    );
}

function Certificados() {
    return (
        <div className="cert-vazio">
            <Icone nome="medalha" tamanho={22} />
            <p>
                <strong>Nenhum certificado ainda</strong>
                Cada monitoria finalizada soma horas comprovadas. A emissão da declaração de horas
                chega numa próxima versão.
            </p>
        </div>
    );
}

// O "S.x = ...; render()" do original: aplica a mudança e renova o "agora" usado nas regras
// de prazo (24h para cancelar, 7 dias para confirmar)
function comAgora(mudanca) {
    const agora = new Date();
    return (s) => ({ ...s, ...(typeof mudanca === 'function' ? mudanca(s) : mudanca), agora });
}

function Perfil() {
    const { showToast } = useCasca();
    const raiz = useRef(null);
    const dlgCan = useRef(null);
    const dlgDet = useRef(null);
    const finalizar = useRef(null);
    const editar = useRef(null);
    const excluirConta = useRef(null);
    // Quem abriu o diálogo, para devolver o foco ao fechar
    const gatilho = useRef(null);

    // Até a sessão ser conferida a tela fica como no HTML original: "Carregando seu perfil…"
    const [pronto, setPronto] = useState(false);
    const [S, setS] = useState(() => ({
        carregando: true,
        erro: null,
        usuario: null,
        vagas: [],
        total: 0,
        pagina: 0,
        carregandoMais: false,
        agora: new Date(),
        celular: celularMq.matches,
        aba: null, // computador: finalizar | proximas | historico
        abaEscolhida: false, // true depois que o monitor troca de aba
        abaCel: 'vagas', // celular: vagas | horas | perfil
        filtroCel: 'aberto', // celular, aba Vagas: aberto | historico
        // P2: inscrições das vagas do monitor, por vaga (Map idVaga -> lista)
        inscricoes: new Map(),
        inscricoesErro: false
    }));
    const [alvoId, setAlvoId] = useState(null); // vaga dos diálogos de detalhes e de cancelar
    const [confirmando, setConfirmando] = useState([]); // inscrições com a presença sendo enviada
    const [cancelando, setCancelando] = useState(false);
    // Travas síncronas contra clique duplo (o original desativa o botão na hora): o estado
    // acima só desativa o botão no próximo desenho
    const enviandoPresenca = useRef(new Set());
    const enviandoCancelar = useRef(false);
    const carregandoMais = useRef(false);

    const sessaoExpirada = useCallback(() => {
        showToast('Sessão expirada. Faça login novamente.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }, [showToast]);

    const carregar = useCallback(async () => {
        setS(comAgora({ carregando: true, erro: null }));
        let mudanca;
        try {
            const [perfil, lista, inscricoes] = await Promise.all([
                chamadaApi('/perfil'),
                chamadaApi('/perfil/monitorias?limit=' + LIMITE + '&page=1'),
                // P2: sem a lista de inscritos o perfil continua funcionando; só some o botão
                chamadaApi('/monitorias/monitor/agendamentos?limit=' + LIMITE + '&page=1').catch(
                    () => null
                )
            ]);
            if (perfil.statusHttp === 401 || lista.statusHttp === 401) return sessaoExpirada();
            if (!perfil.success || !perfil.user)
                throw new Error(mensagemDaApi(perfil, 'Não foi possível carregar seus dados.'));
            if (!lista.success)
                throw new Error(mensagemDaApi(lista, 'Não foi possível carregar suas vagas.'));
            const vagas = (lista.monitorias || []).map(D.normalizar);
            mudanca = {
                usuario: perfil.user,
                inscricoesErro: !inscricoes || !inscricoes.success,
                inscricoes: D.agruparInscricoes(
                    ((inscricoes && inscricoes.agendamentos) || []).map(D.normalizarInscricao)
                ),
                vagas,
                total: lista.paginacao ? lista.paginacao.total : vagas.length,
                pagina: 1
            };
        } catch (erro) {
            mudanca = { erro: erro.message || 'Falha na comunicação com o servidor.' };
            console.error('[MoniPro] Erro ao carregar o perfil do monitor.', erro);
        }
        setS(comAgora({ ...mudanca, carregando: false }));
    }, [sessaoExpirada]);

    // P3 (R7): quem está logado vem de GET /auth/sessao (o token fica no cookie httpOnly)
    useEffect(() => {
        let ativo = true;
        obterSessao().then(
            (usuarioSessao) => {
                if (!ativo) return;
                if (!usuarioSessao) return sessaoExpirada();
                if (usuarioSessao.tipo !== 'monitor') {
                    window.location.href = 'perfil_aluno.html';
                    return;
                }
                setPronto(true);
                carregar();
            },
            (erro) => {
                if (ativo)
                    showToast(
                        erro.message || 'Falha na comunicação com o servidor.',
                        'error',
                        erro
                    );
            }
        );
        return () => {
            ativo = false;
        };
    }, [carregar, sessaoExpirada, showToast]);

    useEffect(() => {
        const aoMudar = () => setS(comAgora({ celular: celularMq.matches }));
        celularMq.addEventListener('change', aoMudar);
        return () => celularMq.removeEventListener('change', aoMudar);
    }, []);

    // Espaço para a barra de abas do celular (fora do React: a classe fica no <body>)
    const celular = pronto && S.celular;
    useEffect(() => {
        document.body.classList.toggle('pp-com-abas', celular);
        return () => document.body.classList.remove('pp-com-abas');
    }, [celular]);

    // --- Peças ---
    const L = D.separar(S.vagas, S.agora);
    const minutos = D.minutosComprovados(S.vagas);
    const temDados = !S.carregando && !S.erro && S.vagas.length > 0;
    const u = S.usuario;
    const pontos = u ? Number(u.pontos) || 0 : 0;
    const alvo = S.vagas.find((v) => v.id === alvoId);
    // P2 (R4): presença confirmada pelo monitor depois do início da sessão (D1)
    const inscricoesDa = (v) => S.inscricoes.get(v.id) || [];
    const aConfirmar = (v) => D.presencasAConfirmar(inscricoesDa(v), v, S.agora);

    // Computador: abre em "Para finalizar" quando há o que finalizar. Só decide com os dados na
    // tela: durante o carregamento a lista está vazia e a escolha ficaria presa em "Próximas".
    let aba = S.aba;
    if (temDados && (!S.abaEscolhida || (aba === 'finalizar' && !L.finalizar.length)))
        aba = L.finalizar.length ? 'finalizar' : 'proximas';
    if (!aba) aba = 'finalizar';
    // Como o original (monitor.js), a aba ajustada fica gravada: um redesenho depois não volta
    // sozinho para "Para finalizar" (ajuste durante o render; a guarda evita laço)
    if (temDados && aba !== S.aba) setS((s) => ({ ...s, aba }));

    // --- Ações ---
    async function carregarMais() {
        if (carregandoMais.current) return;
        carregandoMais.current = true;
        setS(comAgora({ carregandoMais: true }));
        let mudanca = {};
        try {
            const lista = await chamadaApi(
                '/perfil/monitorias?limit=' + LIMITE + '&page=' + (S.pagina + 1)
            );
            if (!lista.success)
                throw new Error(mensagemDaApi(lista, 'Não foi possível carregar mais vagas.'));
            mudanca = (s) => {
                const ids = new Set(s.vagas.map((v) => v.id));
                const vagas = s.vagas.concat(
                    (lista.monitorias || []).filter((m) => !ids.has(m.id)).map(D.normalizar)
                );
                return {
                    vagas,
                    total: lista.paginacao ? lista.paginacao.total : vagas.length,
                    pagina: s.pagina + 1
                };
            };
        } catch (erro) {
            showToast(erro.message || 'Não foi possível carregar mais vagas.', 'error', erro);
        }
        carregandoMais.current = false;
        setS(
            comAgora((s) => ({
                ...(typeof mudanca === 'function' ? mudanca(s) : mudanca),
                carregandoMais: false
            }))
        );
    }

    // P2 (R4): PATCH /agendamentos/:id/concluir, feito pelo monitor dono da vaga
    async function confirmarPresenca(inscricao) {
        if (enviandoPresenca.current.has(inscricao.id)) return;
        enviandoPresenca.current.add(inscricao.id);
        const liberar = () => {
            enviandoPresenca.current.delete(inscricao.id);
            setConfirmando((ids) => ids.filter((id) => id !== inscricao.id));
        };
        setConfirmando((ids) => [...ids, inscricao.id]);
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
                liberar();
                return;
            }
            // O foco vai para a marca que só existe depois de redesenhar
            flushSync(() => {
                liberar();
                setS(
                    comAgora((s) => {
                        const inscricoes = new Map(s.inscricoes);
                        inscricoes.set(
                            inscricao.idVaga,
                            (inscricoes.get(inscricao.idVaga) || []).map((x) =>
                                x.id !== inscricao.id
                                    ? x
                                    : {
                                          ...x,
                                          monitorConfirmou: true,
                                          status: dados.concluido ? 'concluido' : x.status
                                      }
                            )
                        );
                        return {
                            inscricoes,
                            usuario:
                                dados.concluido && s.usuario
                                    ? {
                                          ...s.usuario,
                                          pontos: (Number(s.usuario.pontos) || 0) + D.PONTOS_MONITOR
                                      }
                                    : s.usuario
                        };
                    })
                );
            });
            const marca = document.getElementById('pres-' + inscricao.id);
            if (marca) marca.focus();
            showToast(
                dados.mensagem || 'Presença de ' + inscricao.aluno + ' confirmada.',
                'success'
            );
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
            liberar();
        }
    }

    // Detalhes, finalizar, cancelar e editar: de dentro do diálogo de detalhes, ele fecha e o
    // foco continua devendo voltar para a linha que o abriu
    function abrirDe(ev, abrir) {
        const botao = ev.currentTarget;
        const deDentro = botao.closest('dialog');
        if (deDentro) deDentro.close();
        else gatilho.current = botao;
        abrir();
    }
    const abrirDetalhes = (v) => (ev) =>
        abrirDe(ev, () => {
            setAlvoId(v.id);
            dlgDet.current.showModal();
        });
    const abrirCancelar = (v) => (ev) =>
        abrirDe(ev, () => {
            setAlvoId(v.id);
            dlgCan.current.showModal();
        });
    const abrirFinalizar = (v) => (ev) => abrirDe(ev, () => finalizar.current.abrir(v));
    const abrirEditar = (v) => (ev) => abrirDe(ev, () => editar.current.abrir(v, S.agora));

    async function cancelarVaga(ev) {
        ev.preventDefault();
        const v = alvo;
        if (!v || enviandoCancelar.current) return;
        enviandoCancelar.current = true;
        setCancelando(true);
        try {
            const dados = await chamadaApi('/monitorias/' + v.id + '/cancelar', { method: 'PUT' });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (dados.erro || !dados.success) {
                dlgCan.current.close();
                showToast(
                    mensagemDaApi(dados, 'Não foi possível cancelar a vaga.'),
                    'error',
                    dados
                );
                return;
            }
            dlgCan.current.close();
            // A tela redesenha antes do "close": o foco não volta para uma linha que saiu
            flushSync(() => {
                setS(
                    comAgora((s) => ({
                        vagas: s.vagas.map((x) =>
                            x.id !== v.id ? x : { ...x, status: 'cancelada' }
                        )
                    }))
                );
            });
            showToast('Vaga cancelada.', 'success');
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
        } finally {
            enviandoCancelar.current = false;
            setCancelando(false);
        }
    }

    function aoFinalizar(v, fim) {
        flushSync(() => {
            setS(
                comAgora((s) => ({
                    vagas: s.vagas.map((x) =>
                        x.id !== v.id ? x : { ...x, status: 'realizada', fim }
                    )
                }))
            );
        });
    }

    function aoSalvar(id, mudanca) {
        setS(
            comAgora((s) => ({
                vagas: s.vagas.map((x) => (x.id !== id ? x : { ...x, ...mudanca }))
            }))
        );
    }

    // Ao fechar, devolve o foco a quem abriu (ou à aba ativa, se a linha não existe mais).
    // Como no original, o "Editar vaga" fica de fora: o navegador devolve o foco sozinho.
    function aoFecharDialogo() {
        if (document.querySelector('.pp-dlg[open]')) return;
        const botao = gatilho.current;
        if (botao && document.body.contains(botao)) botao.focus();
        else {
            const destino = raiz.current.querySelector('[aria-selected="true"], h1');
            if (destino) destino.focus({ preventScroll: true });
        }
    }

    function trocarAba(chave) {
        flushSync(() => setS(comAgora({ aba: chave, abaEscolhida: true })));
        document.getElementById('aba-' + chave).focus();
    }

    function trocarFiltro(chave) {
        flushSync(() => setS(comAgora({ filtroCel: chave })));
        document.getElementById('filtro-' + chave).focus();
    }

    // Abas do computador pelo teclado (setas, Home, End)
    function teclaNasAbas(ev) {
        let k = ORDEM_ABAS.indexOf(aba);
        if (ev.key === 'ArrowRight') k = (k + 1) % 3;
        else if (ev.key === 'ArrowLeft') k = (k + 2) % 3;
        else if (ev.key === 'Home') k = 0;
        else if (ev.key === 'End') k = 2;
        else return;
        ev.preventDefault();
        trocarAba(ORDEM_ABAS[k]);
    }

    const abrirExcluirConta = (ev) => excluirConta.current.abrir(ev.currentTarget);

    // --- Peças que dependem do estado ---
    const botaoFinalizar = (v, rotulo, classe) => (
        <button
            type="button"
            className={classe}
            data-acao="finalizar"
            data-id={v.id}
            onClick={abrirFinalizar(v)}
        >
            {rotulo}
        </button>
    );

    const botaoCancelar = (v) => (
        <button
            type="button"
            className="pp-btn pp-btn-texto-perigo"
            data-acao="cancelar"
            data-id={v.id}
            onClick={abrirCancelar(v)}
        >
            Cancelar vaga
        </button>
    );

    const botaoEditar = (v) => (
        <button
            type="button"
            className="pp-btn pp-btn-sec"
            data-acao="editar"
            data-id={v.id}
            onClick={abrirEditar(v)}
        >
            Editar
        </button>
    );

    const botaoPresencas = (v) => {
        const n = aConfirmar(v);
        if (!n) return null;
        return (
            <button
                type="button"
                className="pp-btn pp-btn-sec"
                data-acao="detalhes"
                data-id={v.id}
                onClick={abrirDetalhes(v)}
            >
                <Icone nome="ok" tamanho={16} />
                {n === 1 ? 'Confirmar presença' : 'Confirmar presenças (' + n + ')'}
            </button>
        );
    };

    const nota24h = (
        <span className="nota-24h">
            <Icone nome="relogio" tamanho={12} />
            {AVISO_24H}
        </span>
    );

    const acoes = (v) => {
        const g = D.grupo(v, S.agora);
        if (g === 'finalizar')
            return (
                <div className="vg-acoes">
                    {botaoPresencas(v)}
                    {botaoFinalizar(v, 'Finalizar', 'pp-btn pp-btn-pri')}
                </div>
            );
        if (g === 'historico') {
            const presencas = botaoPresencas(v);
            return presencas ? <div className="vg-acoes">{presencas}</div> : null;
        }
        return (
            <div className="vg-acoes">
                {botaoEditar(v)}
                {D.podeCancelar(v, S.agora) ? botaoCancelar(v) : nota24h}
            </div>
        );
    };

    // Aviso quando há presenças a confirmar em vagas do Histórico (já finalizadas), que não
    // aparecem na aba aberta. noCelular: o botão troca o filtro em vez da aba.
    const avisoPresencas = (noCelular) => {
        const n = L.historico.reduce((soma, v) => soma + aConfirmar(v), 0);
        if (!n) return null;
        return (
            <div className="pp-aviso-presenca" role="status">
                <Icone nome="pessoas" tamanho={18} />
                <span>
                    <strong>{D.plural(n, 'presença a confirmar', 'presenças a confirmar')}</strong>
                    {' em vagas já finalizadas. O prazo é de ' +
                        D.DIAS_CONFIRMACAO +
                        ' dias depois de cada sessão.'}
                </span>
                <button
                    type="button"
                    className="pp-btn pp-btn-sec pp-btn-p"
                    data-filtro={noCelular ? 'historico' : undefined}
                    data-aba={noCelular ? undefined : 'historico'}
                    onClick={() => (noCelular ? trocarFiltro('historico') : trocarAba('historico'))}
                >
                    Ver no Histórico
                </button>
            </div>
        );
    };

    const maisAntigas = () => {
        if (S.vagas.length >= S.total) return null;
        return (
            <button
                type="button"
                className="pp-btn pp-btn-sec pp-mais"
                data-acao="mais"
                disabled={S.carregandoMais}
                onClick={carregarMais}
            >
                {S.carregandoMais ? 'Carregando…' : 'Carregar vagas mais antigas'}
            </button>
        );
    };

    const estado = () => {
        if (S.carregando)
            return (
                <>
                    <div className="pp-esqueleto" aria-hidden="true">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <p className="pp-dica">Carregando suas vagas…</p>
                </>
            );
        if (S.erro)
            return (
                <div className="pp-estado erro">
                    <div className="pp-estado-ico">
                        <Icone nome="semRede" tamanho={28} />
                    </div>
                    <h3>Não foi possível carregar suas vagas</h3>
                    <p>{S.erro}</p>
                    <button
                        type="button"
                        className="pp-btn pp-btn-sec"
                        data-acao="recarregar"
                        onClick={carregar}
                    >
                        Tentar de novo
                    </button>
                </div>
            );
        return (
            <div className="pp-estado">
                <div className="pp-estado-ico">
                    <Icone nome="calendario" tamanho={28} />
                </div>
                <h3>Você ainda não abriu nenhuma vaga</h3>
                <p>
                    Escolha uma disciplina, um horário e um local. A vaga aparece aqui e na busca
                    dos alunos.
                </p>
                <a className="pp-btn pp-btn-pri" href="escolha_disciplina.html">
                    <Icone nome="mais" tamanho={18} />
                    Abrir primeira vaga
                </a>
            </div>
        );
    };

    // --- Computador (opção A) ---
    const itemVaga = (v) => {
        const g = D.grupo(v, S.agora);
        return (
            <li key={v.id} className={g === 'finalizar' ? 'vaga vaga-atencao' : 'vaga'}>
                <div className="dt" aria-hidden="true">
                    <span className="dt-sem">{D.DIAS_SEMANA[v.inicio.getDay()]}</span>
                    <span className="dt-dia">{String(v.inicio.getDate()).padStart(2, '0')}</span>
                    <span className="dt-mes">{D.MESES_CURTOS[v.inicio.getMonth()]}</span>
                </div>
                <div className="vg-info">
                    <div className="vg-topo">
                        <h3>{v.disciplina}</h3>
                        <Etiqueta v={v} agora={S.agora} />
                    </div>
                    <div className="vg-meta">
                        <span>
                            <Icone nome="relogio" />
                            <span className="sr-only">{D.diaMes(v.inicio) + ', '}</span>
                            {quando(v)}
                        </span>
                        <span>
                            <Icone nome="local" />
                            {v.local}
                        </span>
                        <span className={lotada(v) ? 'cap cap-cheia' : 'cap'}>
                            <Icone nome="pessoas" />
                            {textoInscritos(v)}
                            <BarraInscritos v={v} />
                        </span>
                    </div>
                </div>
                {acoes(v)}
            </li>
        );
    };

    const telaDesktop = () => {
        const abas = [
            ['finalizar', 'Para finalizar', L.finalizar],
            ['proximas', 'Próximas', L.proximas],
            ['historico', 'Histórico', L.historico]
        ];
        const nome = u ? u.nome_completo || 'Monitor' : 'Carregando…';

        let painel;
        if (!temDados) painel = estado();
        else
            painel = (
                <>
                    {aba === 'historico' ? null : avisoPresencas(false)}
                    {L[aba].length ? (
                        <>
                            <p className="pp-dica">{DICAS[aba]}</p>
                            <ul className="vagas-lista">{L[aba].map(itemVaga)}</ul>
                            {aba === 'historico' ? maisAntigas() : null}
                        </>
                    ) : (
                        <p className="pp-vazio">{VAZIOS[aba]}</p>
                    )}
                </>
            );

        const numeros = temDados
            ? [L.finalizar.length, L.proximas.length, D.duracao(minutos)]
            : S.carregando
              ? ['…', '…', '…']
              : S.erro
                ? ['–', '–', '–']
                : [0, 0, '0h'];

        return (
            <div className="pp-desk">
                <a className="pp-voltar" href="base.html">
                    <Icone nome="esquerda" tamanho={16} />
                    Início
                </a>
                <div className="pp-cabecalho">
                    <div>
                        <h1>Meu perfil</h1>
                        <p>Suas vagas, suas horas e seus certificados.</p>
                    </div>
                    <a className="pp-btn pp-btn-pri" href="escolha_disciplina.html">
                        <Icone nome="mais" tamanho={18} />
                        Abrir nova vaga
                    </a>
                </div>
                <div className="pp-grade">
                    <div className="pp-lateral">
                        <section className="pp-cartao pp-id" aria-label="Seus dados">
                            <div className="avatar" aria-hidden="true">
                                {u ? D.iniciais(u.nome_completo) : ''}
                            </div>
                            <h2 className="pp-nome">{nome}</h2>
                            <div className="pp-chips">
                                <span className="chip chip-papel">Monitor</span>
                                <ChipPontos pontos={pontos} />
                            </div>
                            <ul className="pp-dados">
                                <li>
                                    <span className="pp-dados-ico">
                                        <Icone nome="email" tamanho={16} />
                                    </span>
                                    <span>
                                        <small>E-mail</small>
                                        {u ? u.email : ''}
                                    </span>
                                </li>
                                <li>
                                    <span className="pp-dados-ico">
                                        <Icone nome="matricula" tamanho={16} />
                                    </span>
                                    <span>
                                        <small>Matrícula</small>
                                        {u ? u.matricula : ''}
                                    </span>
                                </li>
                            </ul>
                            {/* R3 (LGPD): Aviso de Privacidade e "Excluir minha conta" */}
                            {u ? <BlocoPrivacidade aoExcluir={abrirExcluirConta} /> : null}
                        </section>
                        <section className="pp-cartao pp-cert" aria-labelledby="h-cert">
                            <h2 id="h-cert">Certificados</h2>
                            <Certificados />
                        </section>
                    </div>
                    <div className="pp-principal">
                        <div className="pp-numeros" aria-label="Resumo">
                            {numeros.map((n, k) => (
                                <div
                                    key={k}
                                    className={
                                        k === 0 && temDados && L.finalizar.length
                                            ? 'pp-cartao pp-numero atencao'
                                            : 'pp-cartao pp-numero'
                                    }
                                >
                                    <span className="n">{n}</span>
                                    <span className="l">{ROTULOS_NUMEROS[k]}</span>
                                </div>
                            ))}
                        </div>
                        <section className="pp-cartao pp-vagas" aria-labelledby="h-vagas">
                            <h2 id="h-vagas">Minhas vagas</h2>
                            <div
                                className="pp-abas"
                                role="tablist"
                                aria-label="Filtrar vagas"
                                onKeyDown={teclaNasAbas}
                            >
                                {abas.map(([k, t, arr]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className="pp-aba"
                                        role="tab"
                                        id={'aba-' + k}
                                        aria-selected={aba === k}
                                        aria-controls="painel-vagas"
                                        tabIndex={aba === k ? 0 : -1}
                                        data-aba={k}
                                        onClick={() => trocarAba(k)}
                                    >
                                        {t}
                                        {temDados ? (
                                            <span
                                                className={
                                                    k === 'finalizar' && arr.length
                                                        ? 'cnt atencao'
                                                        : 'cnt'
                                                }
                                            >
                                                {arr.length}
                                            </span>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                            <div id="painel-vagas" role="tabpanel" aria-labelledby={'aba-' + aba}>
                                {painel}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    };

    // --- Celular (opção C) ---
    const linhaCel = (v) => {
        const g = D.grupo(v, S.agora);
        let sub;
        if (g === 'historico')
            sub = D.realizada(v) ? (
                <>
                    <span className="ponto ok"></span>
                    {'Realizada' + duracaoDa(v)}
                </>
            ) : (
                <>
                    <span className="ponto perigo"></span>
                    Cancelada
                </>
            );
        else sub = D.hora(v.inicio) + ' · ' + textoInscritos(v, true);
        const n = aConfirmar(v);
        return (
            <li key={v.id} className={g === 'finalizar' ? 'lc lc-atencao' : 'lc'}>
                <button
                    type="button"
                    className="lc-main"
                    data-acao="detalhes"
                    data-id={v.id}
                    onClick={abrirDetalhes(v)}
                >
                    <span className="lc-data">
                        <b>{String(v.inicio.getDate()).padStart(2, '0')}</b>
                        {D.MESES_CURTOS[v.inicio.getMonth()]}
                    </span>
                    <span className="lc-texto">
                        <span className="lc-titulo">{v.disciplina}</span>
                        <span className="lc-sub">
                            {sub}
                            {n ? (
                                <>
                                    {' · '}
                                    <span className="lc-presenca">
                                        {D.plural(n, 'presença', 'presenças') + ' a confirmar'}
                                    </span>
                                </>
                            ) : null}
                        </span>
                    </span>
                    {g === 'finalizar' ? null : <Icone nome="direita" tamanho={18} />}
                </button>
                {g === 'finalizar' ? botaoFinalizar(v, 'Finalizar', 'lc-acao') : null}
            </li>
        );
    };

    const historicoCel = () => {
        if (!L.historico.length)
            return <p className="pp-vazio">Vagas finalizadas e canceladas aparecem aqui.</p>;
        const real = L.historico.filter(D.realizada).length;
        const canc = L.historico.length - real;
        const resumo = [
            D.plural(real, 'realizada', 'realizadas'),
            canc ? D.plural(canc, 'cancelada', 'canceladas') : '',
            D.duracao(minutos) + ' comprovadas'
        ]
            .filter(Boolean)
            .join(' · ');
        return (
            <>
                <p className="lc-resumo">{resumo}</p>
                {D.agruparPorMes(L.historico).map((g) => [
                    <h2 key={'t-' + g.rotulo} className="lc-secao">
                        {g.rotulo}
                    </h2>,
                    <ul key={'l-' + g.rotulo} className="lc-lista">
                        {g.vagas.map(linhaCel)}
                    </ul>
                ])}
                {maisAntigas()}
            </>
        );
    };

    const telaVagasCel = () => {
        let corpo;
        if (!temDados) corpo = estado();
        else if (S.filtroCel === 'historico') corpo = historicoCel();
        else
            corpo = (
                <>
                    {avisoPresencas(true)}
                    {L.finalizar.length ? (
                        <>
                            <h2 className="lc-secao atencao">
                                {'Para finalizar · ' + L.finalizar.length}
                            </h2>
                            <ul className="lc-lista">{L.finalizar.map(linhaCel)}</ul>
                        </>
                    ) : null}
                    <h2 className="lc-secao">{'Próximas · ' + L.proximas.length}</h2>
                    {L.proximas.length ? (
                        <ul className="lc-lista">{L.proximas.map(linhaCel)}</ul>
                    ) : (
                        <p className="pp-vazio">Nenhuma vaga marcada.</p>
                    )}
                </>
            );
        return (
            <>
                <div className="cel-topo">
                    <h1>Minhas vagas</h1>
                    <a className="pp-btn pp-btn-pri pp-btn-p" href="escolha_disciplina.html">
                        <Icone nome="mais" tamanho={16} />
                        Nova vaga
                    </a>
                </div>
                {temDados ? (
                    <div className="seg-fixo">
                        <div className="seg" role="tablist" aria-label="Filtrar vagas">
                            <button
                                type="button"
                                role="tab"
                                id="filtro-aberto"
                                aria-selected={S.filtroCel === 'aberto'}
                                data-filtro="aberto"
                                onClick={() => trocarFiltro('aberto')}
                            >
                                Em aberto
                                {L.finalizar.length ? (
                                    <i className="selo">{L.finalizar.length}</i>
                                ) : null}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                id="filtro-historico"
                                aria-selected={S.filtroCel === 'historico'}
                                data-filtro="historico"
                                onClick={() => trocarFiltro('historico')}
                            >
                                Histórico
                            </button>
                        </div>
                    </div>
                ) : null}
                <div
                    className="cel-corpo"
                    role={temDados ? 'tabpanel' : undefined}
                    aria-labelledby={temDados ? 'filtro-' + S.filtroCel : undefined}
                >
                    {corpo}
                </div>
            </>
        );
    };

    const telaHorasCel = () => {
        let topo;
        if (S.carregando)
            topo = (
                <div className="pp-esqueleto" aria-hidden="true">
                    <span></span>
                </div>
            );
        else if (S.erro) topo = estado();
        else {
            const porDisc = D.horasPorDisciplina(S.vagas);
            const max = porDisc.length ? porDisc[0].minutos : 1;
            const n = S.vagas.filter(D.realizada).length;
            topo = (
                <>
                    <div className="horas-total">
                        <span className="n">{D.duracao(minutos)}</span>
                        <span className="l">
                            {n
                                ? 'comprovadas em ' + D.plural(n, 'monitoria', 'monitorias')
                                : 'Finalize monitorias para somar horas.'}
                        </span>
                    </div>
                    {porDisc.length ? (
                        <ul className="horas-barras">
                            {porDisc.map((x) => (
                                <li key={x.disciplina}>
                                    <span className="bl">{x.disciplina}</span>
                                    <span className="bv">{D.duracao(x.minutos)}</span>
                                    <span className="bb" aria-hidden="true">
                                        <i
                                            style={{
                                                width: Math.round((x.minutos / max) * 100) + '%'
                                            }}
                                        ></i>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </>
            );
        }
        return (
            <>
                <div className="cel-topo">
                    <h1>Horas e certificados</h1>
                </div>
                <div className="cel-corpo">
                    {topo}
                    <h2 className="lc-secao">Certificados</h2>
                    <Certificados />
                </div>
            </>
        );
    };

    const telaPerfilCel = () => (
        <>
            <div className="cel-topo">
                <h1>Meus dados</h1>
            </div>
            <div className="cel-corpo">
                <div className="cel-id">
                    <div className="avatar" aria-hidden="true">
                        {u ? D.iniciais(u.nome_completo) : ''}
                    </div>
                    <strong>{u ? u.nome_completo : S.erro ? '—' : 'Carregando…'}</strong>
                    <div className="pp-chips">
                        <span className="chip chip-papel">Monitor</span>
                        <ChipPontos pontos={pontos} />
                    </div>
                </div>
                <dl className="cel-dl">
                    <div>
                        <dt>E-mail</dt>
                        <dd>{u ? u.email : '—'}</dd>
                    </div>
                    <div>
                        <dt>Matrícula</dt>
                        <dd>{u ? u.matricula : '—'}</dd>
                    </div>
                </dl>
                {u ? <BlocoPrivacidade aoExcluir={abrirExcluirConta} /> : null}
            </div>
        </>
    );

    const telaCelular = () => (
        <div className="pp-cel">
            {S.abaCel === 'horas'
                ? telaHorasCel()
                : S.abaCel === 'perfil'
                  ? telaPerfilCel()
                  : telaVagasCel()}
            <nav className="cel-abas" aria-label="Seções do perfil">
                {ABAS_CEL.map(([k, t, ic]) => (
                    <button
                        key={k}
                        type="button"
                        data-aba-cel={k}
                        aria-current={S.abaCel === k ? 'page' : 'false'}
                        onClick={(ev) => {
                            setS(comAgora({ abaCel: k }));
                            window.scrollTo(0, 0);
                            ev.currentTarget.focus();
                        }}
                    >
                        <Icone nome={ic} tamanho={22} />
                        <span>{t}</span>
                        {k === 'vagas' && temDados && L.finalizar.length ? (
                            <i className="selo-aba">
                                {L.finalizar.length}
                                <span className="sr-only"> para finalizar</span>
                            </i>
                        ) : null}
                    </button>
                ))}
            </nav>
        </div>
    );

    // --- Diálogo de detalhes ---
    const presencas = (v) => {
        if (v.status === 'cancelada') return null;
        const lista = inscricoesDa(v);
        const limite = D.limiteConfirmacao(v);
        let nota;
        if (S.inscricoesErro) nota = 'Não foi possível carregar os inscritos desta vaga.';
        else if (!lista.length) nota = 'Ninguém se inscreveu nesta vaga.';
        else if (S.agora < v.inicio)
            nota = 'Você poderá confirmar a presença dos alunos depois do início da sessão.';
        else if (S.agora > limite)
            nota =
                'O prazo de ' +
                D.DIAS_CONFIRMACAO +
                ' dias para confirmar terminou em ' +
                D.diaMes(limite) +
                '.';
        else
            nota =
                'Confirme até ' +
                D.diaMes(limite) +
                ' às ' +
                D.hora(limite) +
                '. O aluno também confirma pelo perfil dele. Com as duas confirmações, você ganha +' +
                D.PONTOS_MONITOR +
                ' pontos e o aluno +' +
                D.PONTOS_ALUNO +
                '.';
        const itens = lista.map((i) => {
            const sit = D.situacaoPresenca(i, v, S.agora, 'monitor');
            let lado = null;
            if (sit === 'confirmar') {
                const enviando = confirmando.includes(i.id);
                lado = (
                    <button
                        type="button"
                        className="pp-btn pp-btn-sec pp-btn-p"
                        data-acao="presenca"
                        data-id={v.id}
                        data-ag={i.id}
                        aria-label={'Confirmar presença de ' + i.aluno}
                        disabled={enviando}
                        onClick={() => confirmarPresenca(i)}
                    >
                        {enviando ? 'Confirmando…' : 'Confirmar presença'}
                    </button>
                );
            } else if (sit === 'confirmada')
                lado = (
                    <span className="pill pill-ok" tabIndex={-1} id={'pres-' + i.id}>
                        <Icone nome="ok" tamanho={12} />
                        Presença confirmada
                    </span>
                );
            else if (sit === 'aguardando')
                lado = (
                    <span className="pp-insc-estado" tabIndex={-1} id={'pres-' + i.id}>
                        <Icone nome="relogio" tamanho={12} />
                        Aguardando o aluno
                    </span>
                );
            else if (sit === 'expirada')
                lado = <span className="pp-insc-estado">Não confirmada</span>;
            return (
                <li key={i.id}>
                    <span className="pp-insc-nome">
                        <Icone nome="pessoa" tamanho={16} />
                        <span>
                            {i.aluno}
                            {sit === 'confirmar' && i.alunoConfirmou ? (
                                <small>Já confirmou a presença</small>
                            ) : null}
                        </span>
                    </span>
                    {lado}
                </li>
            );
        });
        return (
            <section className="pp-insc" aria-labelledby="insc-titulo">
                <h3 id="insc-titulo">Presença dos inscritos</h3>
                <p className="pp-insc-nota">{nota}</p>
                {itens.length ? <ul>{itens}</ul> : null}
            </section>
        );
    };

    const detalhes = (v) => {
        const g = D.grupo(v, S.agora);
        let acoesDet = null;
        if (g === 'finalizar')
            acoesDet = (
                <div className="pp-det-acoes">
                    {botaoFinalizar(v, 'Finalizar monitoria', 'pp-btn pp-btn-pri')}
                </div>
            );
        else if (g === 'proximas')
            acoesDet = D.podeCancelar(v, S.agora) ? (
                <div className="pp-det-acoes">
                    {botaoEditar(v)}
                    {botaoCancelar(v)}
                </div>
            ) : (
                <>
                    <div className="pp-det-acoes">{botaoEditar(v)}</div>
                    <p className="nota-24h nota-bloco">
                        <Icone nome="relogio" tamanho={14} />
                        {AVISO_24H +
                            '. Faltam menos de ' +
                            D.HORAS_CANCELAMENTO +
                            'h para o início.'}
                    </p>
                </>
            );
        return (
            <>
                <Etiqueta v={v} agora={S.agora} />
                <dl className="cel-dl">
                    <div>
                        <dt>Data</dt>
                        <dd>{D.diaCurto(v.inicio)}</dd>
                    </div>
                    <div>
                        <dt>Horário</dt>
                        <dd>{quando(v)}</dd>
                    </div>
                    <div>
                        <dt>Local</dt>
                        <dd>{v.local}</dd>
                    </div>
                    <div>
                        <dt>Inscritos</dt>
                        <dd>{textoInscritos(v)}</dd>
                    </div>
                </dl>
                {presencas(v)}
                {acoesDet}
            </>
        );
    };

    // Aviso do diálogo de cancelar: quantos alunos perdem a vaga
    let avisoCancelar = 'Esta ação não pode ser desfeita.';
    if (alvo && alvo.inscritos)
        avisoCancelar =
            D.plural(alvo.inscritos, 'aluno inscrito perde', 'alunos inscritos perdem') +
            ' a vaga. ' +
            avisoCancelar;
    else if (alvo && alvo.inscritos === 0)
        avisoCancelar = 'Ninguém se inscreveu ainda. ' + avisoCancelar;

    // No celular os diálogos viram painéis que sobem do rodapé
    const classeDlg = celular ? 'pp-dlg pp-painel' : 'pp-dlg';

    return (
        <>
            <main
                className="pagina-perfil"
                id="perfil-app"
                aria-busy={pronto ? S.carregando : true}
                ref={raiz}
            >
                {!pronto ? (
                    <p className="pp-carregando">Carregando seu perfil…</p>
                ) : S.celular ? (
                    telaCelular()
                ) : (
                    telaDesktop()
                )}
            </main>

            {/* Finalizar monitoria: término numa caixa clicável com lista curta */}
            <DialogoFinalizar
                ref={finalizar}
                className={classeDlg}
                aoFinalizar={aoFinalizar}
                sessaoExpirada={sessaoExpirada}
                aoFechar={aoFecharDialogo}
            />

            {/* Cancelar vaga (só aparece para vagas com 24h ou mais até o início, RN-001) */}
            <dialog
                ref={dlgCan}
                className={classeDlg}
                id="dlg-cancelar"
                aria-labelledby="can-titulo"
                onClose={aoFecharDialogo}
            >
                <form method="dialog" id="can-form" onSubmit={cancelarVaga}>
                    <div>
                        <h2 id="can-titulo">Cancelar esta vaga?</h2>
                        <p className="pp-sub" id="can-sub">
                            {alvo
                                ? alvo.disciplina +
                                  ' · ' +
                                  D.diaCurto(alvo.inicio) +
                                  ' às ' +
                                  D.hora(alvo.inicio)
                                : ''}
                        </p>
                    </div>
                    <p className="pp-aviso" id="can-aviso">
                        {alvo ? avisoCancelar : ''}
                    </p>
                    <div className="pp-acoes">
                        <button
                            type="button"
                            className="pp-btn pp-btn-sec"
                            data-fechar=""
                            onClick={() => dlgCan.current.close()}
                        >
                            Manter vaga
                        </button>
                        <button
                            type="submit"
                            className="pp-btn pp-btn-perigo"
                            id="can-confirmar"
                            disabled={cancelando}
                        >
                            Cancelar vaga
                        </button>
                    </div>
                </form>
            </dialog>

            {/* Detalhes da vaga (celular): abre ao tocar numa linha da lista */}
            <dialog
                ref={dlgDet}
                className={classeDlg}
                id="dlg-detalhes"
                aria-labelledby="det-titulo"
                onClose={aoFecharDialogo}
                onClick={(ev) => {
                    if (ev.target === ev.currentTarget) ev.currentTarget.close(); // toque fora do painel
                }}
            >
                <div className="pp-dlg-corpo">
                    <div className="pp-dlg-topo">
                        <h2 id="det-titulo">{alvo ? alvo.disciplina : ''}</h2>
                        <button
                            type="button"
                            className="pp-icone-btn"
                            data-fechar=""
                            aria-label="Fechar"
                            onClick={() => dlgDet.current.close()}
                        >
                            <svg
                                className="ico"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                aria-hidden="true"
                            >
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div id="det-corpo" className="pp-det">
                        {alvo ? detalhes(alvo) : null}
                    </div>
                </div>
            </dialog>

            {/* Editar vaga: só vaga ativa e futura do próprio monitor (PATCH /monitorias/:id) */}
            <DialogoEditar ref={editar} className={classeDlg} aoSalvar={aoSalvar} />

            <DialogoExcluirConta ref={excluirConta} painel={celular} />
        </>
    );
}

export default function PerfilMonitor() {
    return (
        <Casca>
            <Perfil />
        </Casca>
    );
}
