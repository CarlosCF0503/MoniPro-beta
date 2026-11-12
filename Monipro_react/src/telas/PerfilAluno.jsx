// Perfil do aluno: porte de Monipro_web/perfil_aluno.html + JS/perfil/aluno.js.
// - >= 700px (opção A): dados e pontos numa coluna lateral; monitorias em três abas
//   (Para confirmar, Próximas, Histórico) com contagem.
// - < 700px (opção C): abas no rodapé (Monitorias, Pontos, Perfil); Monitorias tem o filtro
//   "Em aberto / Histórico" e os detalhes abrem num painel que sobe do rodapé.
// P2 (R4): depois de cada sessão o aluno confirma a própria presença; com a confirmação do
// monitor também, ele ganha os pontos.
// Cabeçalho, menu lateral, aviso de sair e toast vêm da Casca. O que os dois perfis dividem
// (funções de dados e "Excluir minha conta") fica em src/perfil/.
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
// Mesmos arquivos e mesma ordem dos <link> do perfil_aluno.html original (o base.css vem da
// Casca). O estilo é o do perfil do monitor: os dois perfis seguem a mesma montagem.
import '../../../Monipro_web/CSS/fontes.css';
import Casca, { useCasca } from '../Casca.jsx';
import '../../../Monipro_web/CSS/perfil_monitor.css';
import { chamadaApi, mensagemDaApi, obterSessao } from '../api.js';
import * as D from '../perfil/dados.js';
import { BlocoPrivacidade, DialogoExcluirConta } from '../perfil/ExcluirConta.jsx';

const LIMITE = 100; // máximo aceito por utils/paginacao.js
const celularMq = window.matchMedia('(max-width: 699px)');

// --- Ícones (os mesmos do perfil do monitor) ---
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
const AVISO_MUDOU = 'Pode cancelar até o início';
// Editar vaga: o que mudou desde a inscrição ("Horário alterado: era ...")
const textoMudou = (i) => D.mudancasDaVaga(i).join(' ') || 'A vaga foi alterada.';
const SITUACOES = {
    confirmar: ['pill-atencao', 'relogio', 'Confirme sua presença'],
    antes: ['pill-aberta', 'calendario', 'Inscrito'],
    aguardando: ['pill-aberta', 'relogio', 'Aguardando o monitor'],
    confirmada: ['pill-ok', 'ok', 'Presença confirmada'],
    expirada: ['pill-perigo', 'x', 'Presença não confirmada'],
    cancelada: ['pill-perigo', 'x', 'Vaga cancelada']
};
const ABAS_CEL = [
    ['monitorias', 'Monitorias', 'calendario'],
    ['pontos', 'Pontos', 'moeda'],
    ['perfil', 'Perfil', 'pessoa']
];
const ORDEM_ABAS = ['confirmar', 'proximas', 'historico'];
const ROTULOS_NUMEROS = ['Para confirmar', 'Próximas monitorias', 'Presenças confirmadas'];
const DICAS = {
    confirmar: 'Monitorias que já aconteceram. Confirme a sua presença para ganhar os pontos.',
    proximas: 'Em ordem de data, da mais próxima para a mais distante.',
    historico: 'Presenças confirmadas, aguardando o monitor e encerradas.'
};
const VAZIOS = {
    confirmar: 'Tudo em dia. Nenhuma presença esperando a sua confirmação.',
    proximas: 'Nenhuma monitoria marcada. Escolha uma disciplina para marcar.',
    historico: 'As monitorias que já passaram aparecem aqui.'
};

function Etiqueta({ sit }) {
    const [classe, ico, texto] = SITUACOES[sit];
    return (
        <span className={'pill ' + classe}>
            <Icone nome={ico} tamanho={12} />
            {texto}
        </span>
    );
}

function quando(i) {
    return i.fim ? D.hora(i.inicio) + '–' + D.hora(i.fim) : D.hora(i.inicio);
}

function limiteTexto(i) {
    const lim = D.limiteConfirmacao({ inicio: i.inicio });
    return D.diaMes(lim) + ' às ' + D.hora(lim);
}

// Nota curta sobre a presença, conforme o que já foi confirmado
function notaPresenca(i, sit) {
    if (sit === 'confirmar')
        return i.monitorConfirmou
            ? 'O monitor já confirmou. Confirme até ' +
                  limiteTexto(i) +
                  ' para ganhar +' +
                  D.PONTOS_ALUNO +
                  ' pontos.'
            : 'Confirme até ' +
                  limiteTexto(i) +
                  '. Os pontos entram quando o monitor também confirmar.';
    if (sit === 'aguardando')
        return (
            'Você confirmou. Os +' + D.PONTOS_ALUNO + ' pontos entram quando o monitor confirmar.'
        );
    if (sit === 'expirada')
        return 'O prazo de ' + D.DIAS_CONFIRMACAO + ' dias para confirmar terminou.';
    return '';
}

function ChipPontos({ pontos }) {
    return (
        <span className="chip chip-pontos" title="Pontos de gamificação">
            <Icone nome="moeda" tamanho={14} />
            {pontos + ' pontos'}
        </span>
    );
}

function ComoGanhar() {
    return (
        <div className="cert-vazio">
            <Icone nome="moeda" tamanho={22} />
            <p>
                <strong>Como ganhar pontos</strong>
                {'Depois de cada monitoria, confirme a sua presença aqui. Quando o monitor também confirmar, você ganha +' +
                    D.PONTOS_ALUNO +
                    ' pontos. O prazo é de ' +
                    D.DIAS_CONFIRMACAO +
                    ' dias.'}
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
    const detSituacao = useRef(null);
    const excluirConta = useRef(null);
    // Quem abriu o diálogo, para devolver o foco ao fechar
    const gatilho = useRef(null);

    // Até a sessão ser conferida a tela fica como no HTML original: "Carregando seu perfil…"
    const [pronto, setPronto] = useState(false);
    const [S, setS] = useState(() => ({
        carregando: true,
        erro: null,
        usuario: null,
        inscricoes: [],
        agora: new Date(),
        celular: celularMq.matches,
        aba: null, // computador: confirmar | proximas | historico
        abaEscolhida: false,
        abaCel: 'monitorias', // celular: monitorias | pontos | perfil
        filtroCel: 'aberto' // celular, aba Monitorias: aberto | historico
    }));
    const [alvoId, setAlvoId] = useState(null); // inscrição dos diálogos de detalhes e de cancelar
    const [confirmando, setConfirmando] = useState([]); // ids com a presença sendo enviada
    const [cancelando, setCancelando] = useState(false);
    // Trava síncrona contra clique duplo (o original desativa o botão na hora): o estado acima
    // só desativa o botão no próximo desenho
    const enviandoPresenca = useRef(new Set());
    const enviandoCancelar = useRef(false);

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
            const [perfil, lista] = await Promise.all([
                chamadaApi('/perfil'),
                chamadaApi('/perfil/agendamentos?limit=' + LIMITE + '&page=1')
            ]);
            if (perfil.statusHttp === 401 || lista.statusHttp === 401) return sessaoExpirada();
            if (!perfil.success || !perfil.user)
                throw new Error(mensagemDaApi(perfil, 'Não foi possível carregar seus dados.'));
            if (!lista.success)
                throw new Error(mensagemDaApi(lista, 'Não foi possível carregar suas monitorias.'));
            mudanca = {
                usuario: perfil.user,
                inscricoes: (lista.agendamentos || []).map(D.normalizarMinhaInscricao)
            };
        } catch (erro) {
            mudanca = { erro: erro.message || 'Falha na comunicação com o servidor.' };
            console.error('[MoniPro] Erro ao carregar o perfil do aluno.', erro);
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
                if (usuarioSessao.tipo === 'monitor') {
                    window.location.href = 'perfil_monitor.html';
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
    const L = D.separarInscricoes(S.inscricoes, S.agora);
    const situacao = (i) => D.situacaoDoAluno(i, S.agora);
    const confirmadas = S.inscricoes.filter((i) => i.status === 'concluido').length;
    const temDados = !S.carregando && !S.erro && S.inscricoes.length > 0;
    const u = S.usuario;
    const pontos = u ? Number(u.pontos) || 0 : 0;
    const alvo = S.inscricoes.find((i) => i.id === alvoId);

    // Computador: abre em "Para confirmar" quando há o que confirmar
    let aba = S.aba;
    if (temDados && (!S.abaEscolhida || (aba === 'confirmar' && !L.confirmar.length)))
        aba = L.confirmar.length ? 'confirmar' : 'proximas';
    if (!aba) aba = 'confirmar';
    // Como o original (aluno.js), a aba ajustada fica gravada: um redesenho depois não volta
    // sozinho para "Para confirmar"
    // (ajuste durante o render, padrão do React para estado derivado; a guarda evita laço)
    if (temDados && aba !== S.aba) setS((s) => ({ ...s, aba }));

    // --- Ações ---
    // P2 (R4): PATCH /agendamentos/:id/presenca, feito pelo próprio aluno
    async function confirmarPresenca(i, noDialogo) {
        if (enviandoPresenca.current.has(i.id)) return;
        enviandoPresenca.current.add(i.id);
        const liberar = () => {
            enviandoPresenca.current.delete(i.id);
            setConfirmando((ids) => ids.filter((id) => id !== i.id));
        };
        setConfirmando((ids) => [...ids, i.id]);
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
                liberar();
                return;
            }
            // O foco vai para um elemento que só existe depois de redesenhar
            flushSync(() => {
                liberar();
                setS(
                    comAgora((s) => ({
                        inscricoes: s.inscricoes.map((x) =>
                            x.id !== i.id
                                ? x
                                : {
                                      ...x,
                                      alunoConfirmou: true,
                                      status: dados.concluido ? 'concluido' : x.status
                                  }
                        ),
                        usuario:
                            dados.concluido && s.usuario
                                ? {
                                      ...s.usuario,
                                      pontos: (Number(s.usuario.pontos) || 0) + D.PONTOS_ALUNO
                                  }
                                : s.usuario
                    }))
                );
            });
            if (noDialogo) detSituacao.current.focus();
            else {
                const destino = raiz.current.querySelector('[aria-selected="true"]');
                if (destino) destino.focus();
            }
            showToast(dados.mensagem || 'Presença registrada.', 'success');
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
            liberar();
        }
    }

    // Detalhes e cancelar: de dentro do diálogo de detalhes, ele fecha e o foco continua
    // devendo voltar para a linha que o abriu
    function abrirDialogo(dlg, i, botao) {
        const deDentro = botao.closest('dialog');
        if (deDentro) deDentro.close();
        else gatilho.current = botao;
        // Título e corpo preenchidos antes de abrir, como o original (o aria-labelledby do
        // diálogo já precisa do nome certo quando ele abre)
        flushSync(() => setAlvoId(i.id));
        dlg.current.showModal();
    }

    async function cancelarInscricao(ev) {
        ev.preventDefault();
        const i = alvo;
        if (!i || enviandoCancelar.current) return;
        enviandoCancelar.current = true;
        setCancelando(true);
        try {
            const dados = await chamadaApi('/agendamentos/' + i.id, { method: 'DELETE' });
            if (dados.statusHttp === 401) return sessaoExpirada();
            if (dados.erro || !dados.success) {
                dlgCan.current.close();
                showToast(
                    mensagemDaApi(dados, 'Não foi possível cancelar a inscrição.'),
                    'error',
                    dados
                );
                return;
            }
            // A linha sai da lista antes de o diálogo fechar: o foco não volta para ela
            flushSync(() => {
                setS(comAgora((s) => ({ inscricoes: s.inscricoes.filter((x) => x.id !== i.id) })));
            });
            dlgCan.current.close();
            showToast('Inscrição cancelada.', 'success');
        } catch (erro) {
            showToast('Erro de rede. Verifique a conexão e tente de novo.', 'error', erro);
        } finally {
            enviandoCancelar.current = false;
            setCancelando(false);
        }
    }

    // Ao fechar, devolve o foco a quem abriu (ou à aba ativa, se a linha não existe mais)
    function aoFecharDialogo() {
        if (dlgCan.current.open || dlgDet.current.open) return;
        const botao = gatilho.current;
        if (botao && document.body.contains(botao)) botao.focus();
        else {
            const destino = raiz.current.querySelector('[aria-selected="true"], h1');
            if (destino) destino.focus({ preventScroll: true });
        }
    }

    function trocarAba(chave) {
        setS(comAgora({ aba: chave, abaEscolhida: true }));
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
        ev.currentTarget.children[k].focus();
    }

    const abrirExcluirConta = (ev) => excluirConta.current.abrir(ev.currentTarget);

    // --- Peças que dependem do estado ---
    // rotulo: na linha do celular o botão diz só "Confirmar" (o aria-label leva o texto completo)
    const botaoConfirmar = (i, classe, rotulo, noDialogo) => {
        const enviando = confirmando.includes(i.id);
        return (
            <button
                type="button"
                className={classe}
                data-acao="presenca"
                data-id={i.id}
                aria-label={'Confirmar presença em ' + i.disciplina}
                disabled={enviando}
                onClick={() => confirmarPresenca(i, noDialogo)}
            >
                {enviando ? 'Confirmando…' : rotulo || 'Confirmar presença'}
            </button>
        );
    };

    const botaoCancelar = (i) => (
        <button
            type="button"
            className="pp-btn pp-btn-texto-perigo"
            data-acao="cancelar"
            data-id={i.id}
            onClick={(ev) => abrirDialogo(dlgCan, i, ev.currentTarget)}
        >
            Cancelar inscrição
        </button>
    );

    const acoes = (i, sit) => {
        if (sit === 'confirmar')
            return <div className="vg-acoes">{botaoConfirmar(i, 'pp-btn pp-btn-pri')}</div>;
        if (sit === 'antes')
            return (
                <div className="vg-acoes">
                    {D.podeCancelarInscricao(i, S.agora) ? (
                        <>
                            {i.liberado ? (
                                <span className="nota-24h">
                                    <Icone nome="relogio" tamanho={12} />
                                    {AVISO_MUDOU}
                                </span>
                            ) : null}
                            {botaoCancelar(i)}
                        </>
                    ) : (
                        <span className="nota-24h">
                            <Icone nome="relogio" tamanho={12} />
                            {AVISO_24H}
                        </span>
                    )}
                </div>
            );
        return null;
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
                    <p className="pp-dica">Carregando suas monitorias…</p>
                </>
            );
        if (S.erro)
            return (
                <div className="pp-estado erro">
                    <div className="pp-estado-ico">
                        <Icone nome="semRede" tamanho={28} />
                    </div>
                    <h3>Não foi possível carregar suas monitorias</h3>
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
                <h3>Você ainda não marcou nenhuma monitoria</h3>
                <p>Escolha uma disciplina e um horário com um monitor. A inscrição aparece aqui.</p>
                <a className="pp-btn pp-btn-pri" href="escolha_disciplina.html">
                    <Icone nome="mais" tamanho={18} />
                    Marcar monitoria
                </a>
            </div>
        );
    };

    // --- Computador (opção A) ---
    const itemInscricao = (i) => {
        const sit = situacao(i);
        const nota = notaPresenca(i, sit);
        return (
            <li key={i.id} className={sit === 'confirmar' ? 'vaga vaga-atencao' : 'vaga'}>
                <div className="dt" aria-hidden="true">
                    <span className="dt-sem">{D.DIAS_SEMANA[i.inicio.getDay()]}</span>
                    <span className="dt-dia">{String(i.inicio.getDate()).padStart(2, '0')}</span>
                    <span className="dt-mes">{D.MESES_CURTOS[i.inicio.getMonth()]}</span>
                </div>
                <div className="vg-info">
                    <div className="vg-topo">
                        <h3>{i.disciplina}</h3>
                        <Etiqueta sit={sit} />
                    </div>
                    <div className="vg-meta">
                        <span>
                            <Icone nome="relogio" />
                            <span className="sr-only">{D.diaMes(i.inicio) + ', '}</span>
                            {quando(i)}
                        </span>
                        <span>
                            <Icone nome="local" />
                            {i.local}
                        </span>
                        <span>
                            <Icone nome="pessoa" />
                            {i.monitor}
                        </span>
                    </div>
                    {nota ? <p className="pp-nota-presenca">{nota}</p> : null}
                    {sit === 'antes' && i.liberado ? (
                        <p className="pp-nota-presenca">{textoMudou(i)}</p>
                    ) : null}
                </div>
                {acoes(i, sit)}
            </li>
        );
    };

    const telaDesktop = () => {
        const abas = [
            ['confirmar', 'Para confirmar', L.confirmar],
            ['proximas', 'Próximas', L.proximas],
            ['historico', 'Histórico', L.historico]
        ];
        const nome = u ? u.nome_completo || 'Aluno' : 'Carregando…';

        let painel;
        if (!temDados) painel = estado();
        else if (L[aba].length)
            painel = (
                <>
                    <p className="pp-dica">{DICAS[aba]}</p>
                    <ul className="vagas-lista">{L[aba].map(itemInscricao)}</ul>
                </>
            );
        else painel = <p className="pp-vazio">{VAZIOS[aba]}</p>;

        const numeros = temDados
            ? [L.confirmar.length, L.proximas.length, confirmadas]
            : S.carregando
              ? ['…', '…', '…']
              : S.erro
                ? ['–', '–', '–']
                : [0, 0, 0];

        return (
            <div className="pp-desk">
                <a className="pp-voltar" href="base.html">
                    <Icone nome="esquerda" tamanho={16} />
                    Início
                </a>
                <div className="pp-cabecalho">
                    <div>
                        <h1>Meu perfil</h1>
                        <p>Suas monitorias, sua presença e seus pontos.</p>
                    </div>
                    <a className="pp-btn pp-btn-pri" href="escolha_disciplina.html">
                        <Icone nome="mais" tamanho={18} />
                        Marcar monitoria
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
                                <span className="chip chip-papel">Aluno</span>
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
                        <section className="pp-cartao pp-cert" aria-labelledby="h-pontos">
                            <h2 id="h-pontos">Pontos</h2>
                            <ComoGanhar />
                        </section>
                    </div>
                    <div className="pp-principal">
                        <div className="pp-numeros" aria-label="Resumo">
                            {numeros.map((n, k) => (
                                <div
                                    key={k}
                                    className={
                                        k === 0 && temDados && L.confirmar.length
                                            ? 'pp-cartao pp-numero atencao'
                                            : 'pp-cartao pp-numero'
                                    }
                                >
                                    <span className="n">{n}</span>
                                    <span className="l">{ROTULOS_NUMEROS[k]}</span>
                                </div>
                            ))}
                        </div>
                        <section className="pp-cartao pp-vagas" aria-labelledby="h-insc">
                            <h2 id="h-insc">Minhas monitorias</h2>
                            <div
                                className="pp-abas"
                                role="tablist"
                                aria-label="Filtrar monitorias"
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
                                        aria-controls="painel-insc"
                                        tabIndex={aba === k ? 0 : -1}
                                        data-aba={k}
                                        onClick={(ev) => {
                                            trocarAba(k);
                                            ev.currentTarget.focus();
                                        }}
                                    >
                                        {t}
                                        {temDados ? (
                                            <span
                                                className={
                                                    k === 'confirmar' && arr.length
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
                            <div id="painel-insc" role="tabpanel" aria-labelledby={'aba-' + aba}>
                                {painel}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    };

    // --- Celular (opção C) ---
    const linhaCel = (i) => {
        const sit = situacao(i);
        let sub;
        if (sit === 'antes')
            sub = (
                <>
                    {i.liberado ? <span className="lc-presenca">Vaga alterada</span> : null}
                    {(i.liberado ? ' · ' : '') + D.hora(i.inicio) + ' · ' + i.monitor}
                </>
            );
        else if (sit === 'confirmar')
            sub = (
                <span className="lc-presenca">
                    {'Prazo: ' + D.diaMes(D.limiteConfirmacao({ inicio: i.inicio }))}
                </span>
            );
        else {
            const [classe, , texto] = SITUACOES[sit];
            const ponto = classe === 'pill-ok' ? 'ok' : classe === 'pill-perigo' ? 'perigo' : '';
            sub = (
                <>
                    <span className={'ponto ' + ponto}></span>
                    {texto}
                </>
            );
        }
        return (
            <li key={i.id} className={sit === 'confirmar' ? 'lc lc-atencao' : 'lc'}>
                <button
                    type="button"
                    className="lc-main"
                    data-acao="detalhes"
                    data-id={i.id}
                    onClick={(ev) => abrirDialogo(dlgDet, i, ev.currentTarget)}
                >
                    <span className="lc-data">
                        <b>{String(i.inicio.getDate()).padStart(2, '0')}</b>
                        {D.MESES_CURTOS[i.inicio.getMonth()]}
                    </span>
                    <span className="lc-texto">
                        <span className="lc-titulo">{i.disciplina}</span>
                        <span className="lc-sub">{sub}</span>
                    </span>
                    {sit === 'confirmar' ? null : <Icone nome="direita" tamanho={18} />}
                </button>
                {sit === 'confirmar' ? botaoConfirmar(i, 'lc-acao', 'Confirmar') : null}
            </li>
        );
    };

    const historicoCel = () => {
        if (!L.historico.length)
            return <p className="pp-vazio">As monitorias que já passaram aparecem aqui.</p>;
        return (
            <>
                <p className="lc-resumo">
                    {D.plural(confirmadas, 'presença confirmada', 'presenças confirmadas')}
                </p>
                {D.agruparPorMes(L.historico).map((g) => [
                    <h2 key={'t-' + g.rotulo} className="lc-secao">
                        {g.rotulo}
                    </h2>,
                    <ul key={'l-' + g.rotulo} className="lc-lista">
                        {g.vagas.map(linhaCel)}
                    </ul>
                ])}
            </>
        );
    };

    const telaMonitoriasCel = () => {
        let corpo;
        if (!temDados) corpo = estado();
        else if (S.filtroCel === 'historico') corpo = historicoCel();
        else
            corpo = (
                <>
                    {L.confirmar.length ? (
                        <>
                            <h2 className="lc-secao atencao">
                                {'Para confirmar · ' + L.confirmar.length}
                            </h2>
                            <ul className="lc-lista">{L.confirmar.map(linhaCel)}</ul>
                        </>
                    ) : null}
                    <h2 className="lc-secao">{'Próximas · ' + L.proximas.length}</h2>
                    {L.proximas.length ? (
                        <ul className="lc-lista">{L.proximas.map(linhaCel)}</ul>
                    ) : (
                        <p className="pp-vazio">Nenhuma monitoria marcada.</p>
                    )}
                </>
            );
        const filtrar = (ev) => {
            setS(comAgora({ filtroCel: ev.currentTarget.dataset.filtro }));
            ev.currentTarget.focus();
        };
        return (
            <>
                <div className="cel-topo">
                    <h1>Minhas monitorias</h1>
                    <a className="pp-btn pp-btn-pri pp-btn-p" href="escolha_disciplina.html">
                        <Icone nome="mais" tamanho={16} />
                        Marcar
                    </a>
                </div>
                {temDados ? (
                    <div className="seg-fixo">
                        <div className="seg" role="tablist" aria-label="Filtrar monitorias">
                            <button
                                type="button"
                                role="tab"
                                id="filtro-aberto"
                                aria-selected={S.filtroCel === 'aberto'}
                                data-filtro="aberto"
                                onClick={filtrar}
                            >
                                Em aberto
                                {L.confirmar.length ? (
                                    <i className="selo">{L.confirmar.length}</i>
                                ) : null}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                id="filtro-historico"
                                aria-selected={S.filtroCel === 'historico'}
                                data-filtro="historico"
                                onClick={filtrar}
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

    const telaPontosCel = () => {
        let topo;
        if (S.carregando)
            topo = (
                <div className="pp-esqueleto" aria-hidden="true">
                    <span></span>
                </div>
            );
        else if (S.erro) topo = estado();
        else {
            const porDisc = D.presencasPorDisciplina(S.inscricoes);
            const max = porDisc.length ? porDisc[0].n : 1;
            topo = (
                <>
                    <div className="horas-total">
                        <span className="n">{pontos + ' pontos'}</span>
                        <span className="l">
                            {confirmadas
                                ? D.plural(
                                      confirmadas,
                                      'presença confirmada',
                                      'presenças confirmadas'
                                  )
                                : 'Confirme suas presenças para somar pontos.'}
                        </span>
                    </div>
                    {porDisc.length ? (
                        <ul className="horas-barras">
                            {porDisc.map((x) => (
                                <li key={x.disciplina}>
                                    <span className="bl">{x.disciplina}</span>
                                    <span className="bv">
                                        {D.plural(x.n, 'presença', 'presenças')}
                                    </span>
                                    <span className="bb" aria-hidden="true">
                                        <i
                                            style={{ width: Math.round((x.n / max) * 100) + '%' }}
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
                    <h1>Pontos</h1>
                </div>
                <div className="cel-corpo">
                    {topo}
                    <h2 className="lc-secao">Como ganhar pontos</h2>
                    <ComoGanhar />
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
                        <span className="chip chip-papel">Aluno</span>
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
            {S.abaCel === 'pontos'
                ? telaPontosCel()
                : S.abaCel === 'perfil'
                  ? telaPerfilCel()
                  : telaMonitoriasCel()}
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
                        {k === 'monitorias' && temDados && L.confirmar.length ? (
                            <i className="selo-aba">
                                {L.confirmar.length}
                                <span className="sr-only"> para confirmar</span>
                            </i>
                        ) : null}
                    </button>
                ))}
            </nav>
        </div>
    );

    // --- Diálogo de detalhes (celular) ---
    const detalhes = (i) => {
        const sit = situacao(i);
        const nota = notaPresenca(i, sit);
        let acoesDet = null;
        if (sit === 'confirmar')
            acoesDet = (
                <div className="pp-det-acoes">
                    {botaoConfirmar(i, 'pp-btn pp-btn-pri', undefined, true)}
                </div>
            );
        else if (sit === 'antes')
            acoesDet = D.podeCancelarInscricao(i, S.agora) ? (
                <>
                    {i.liberado ? (
                        <p className="nota-24h nota-bloco">
                            <Icone nome="relogio" tamanho={14} />
                            <span>{textoMudou(i) + ' Você pode cancelar até o início.'}</span>
                        </p>
                    ) : null}
                    <div className="pp-det-acoes">{botaoCancelar(i)}</div>
                </>
            ) : (
                <p className="nota-24h nota-bloco">
                    <Icone nome="relogio" tamanho={14} />
                    {AVISO_24H + '. Faltam menos de ' + D.HORAS_CANCELAMENTO + 'h para o início.'}
                </p>
            );
        return (
            <>
                <span id="det-situacao" tabIndex={-1} ref={detSituacao}>
                    <Etiqueta sit={sit} />
                </span>
                <dl className="cel-dl">
                    <div>
                        <dt>Data</dt>
                        <dd>{D.diaCurto(i.inicio)}</dd>
                    </div>
                    <div>
                        <dt>Horário</dt>
                        <dd>{quando(i)}</dd>
                    </div>
                    <div>
                        <dt>Local</dt>
                        <dd>{i.local}</dd>
                    </div>
                    <div>
                        <dt>Monitor</dt>
                        <dd>{i.monitor}</dd>
                    </div>
                </dl>
                {nota ? <p className="pp-insc-nota">{nota}</p> : null}
                {acoesDet}
            </>
        );
    };

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

            {/* Cancelar inscrição (só com 24h ou mais até o início, RN-001) */}
            <dialog
                ref={dlgCan}
                className={classeDlg}
                id="dlg-cancelar"
                aria-labelledby="can-titulo"
                onClose={aoFecharDialogo}
            >
                <form method="dialog" id="can-form" onSubmit={cancelarInscricao}>
                    <div>
                        <h2 id="can-titulo">Cancelar sua inscrição?</h2>
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
                        A vaga fica livre para outro aluno.
                    </p>
                    <div className="pp-acoes">
                        <button
                            type="button"
                            className="pp-btn pp-btn-sec"
                            data-fechar=""
                            onClick={() => dlgCan.current.close()}
                        >
                            Manter inscrição
                        </button>
                        <button
                            type="submit"
                            className="pp-btn pp-btn-perigo"
                            id="can-confirmar"
                            disabled={cancelando}
                        >
                            Cancelar inscrição
                        </button>
                    </div>
                </form>
            </dialog>

            {/* Detalhes da monitoria (celular): abre ao tocar numa linha da lista */}
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

            <DialogoExcluirConta ref={excluirConta} painel={celular} />
        </>
    );
}

export default function PerfilAluno() {
    return (
        <Casca>
            <Perfil />
        </Casca>
    );
}
