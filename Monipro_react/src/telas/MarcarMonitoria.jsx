// Marcar monitoria (aluno) e criar vaga (monitor): porte de Monipro_web/marcar_monitoria.html e
// de JS/marcar/tela.js. Cabeçalho, menu lateral, aviso de sair e toast vêm da Casca.
// Montagem decidida pelo time: a partir de 700px, calendário + coluna lateral; abaixo disso,
// passo a passo (aluno: Dia → Horário → Confirmar; monitor: Dia → Detalhes → Revisar).
// As duas montagens usam o mesmo estado, então mudar a largura no meio do fluxo não perde nada.
import { useEffect, useRef, useState } from 'react';
// Mesmos arquivos e mesma ordem dos <link> do marcar_monitoria.html original (o base.css vem
// da Casca)
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import Casca, { useCasca } from '../Casca.jsx';
import '../../../Monipro_web/CSS/marcar_monitoria.css';
import { chamadaApi, mensagemDaApi, obterSessao } from '../api.js';
import * as D from './marcar/datas.js';
import {
    Calendario,
    CampoHora,
    Carregando,
    DiaSelecionado,
    Icone,
    LinhaResumo,
    Passos,
    VagaBotao,
    VagaEstatica
} from './marcar/componentes.jsx';

const largura = window.matchMedia('(min-width: 700px)');

// --- 1. Parâmetros ---
const params = new URLSearchParams(window.location.search);
const disciplinaID = params.get('disciplinaID');
const disciplinaNome = params.get('disciplinaNome') || 'Disciplina';

const PASSOS_ALUNO = ['Dia', 'Horário', 'Confirmar'];
const PASSOS_MONITOR = ['Dia', 'Detalhes', 'Revisar'];

const CAMPOS_API = {
    horario: 'hora',
    local: 'local',
    descricao: 'descricao',
    capacidade: 'capacidade'
};

const DICAS = {
    hora: 'De 15 em 15 minutos',
    capacidade: 'Alunos por vaga',
    local: 'Ex.: Lab 3, Bloco C'
};

const SEM_CONEXAO = 'Não foi possível conectar ao servidor. Verifique a conexão e tente de novo.';

// --- 2. Estado ---
function estadoInicial() {
    const agora = new Date();
    return {
        carregando: true,
        erroCarga: null,
        tentativa: 0, // "Tentar de novo" soma 1 e a carga roda outra vez
        vagas: [],
        ano: agora.getFullYear(),
        mes: agora.getMonth(),
        // O original lê o relógio e a largura a cada render(); aqui os dois ficam no estado
        agora,
        desktop: largura.matches,
        // Dia em que as setas do teclado pararam no calendário (tabindex=0); null = o padrão
        focoDia: null,
        // aluno
        dia: null,
        vagaId: null,
        etapa: 'escolha', // escolha | revisao | sucesso
        passo: 1,
        erro: null,
        erroDefinitivo: false,
        // monitor
        form: { dia: null, hora: '', local: '', capacidade: '1', descricao: '' },
        errosApi: {},
        tocados: {},
        erroForm: null,
        m: { passo: 1, etapa: 'form' }, // etapa: form | revisao
        criada: null,
        enviando: false
    };
}

// O "mudar S e chamar render()" do original: além da mudança, relê o relógio e devolve o Tab
// do calendário ao dia padrão (o render() refazia o calendário inteiro).
function redesenho(mudanca) {
    const agora = new Date();
    return (s) => ({ ...s, agora, focoDia: null, ...mudanca(s) });
}

// --- 4. API ---
// Busca todas as páginas (o backend limita 100 por página), para nenhuma vaga sumir.
async function buscarVagas() {
    let pagina = 1;
    let totalPaginas;
    const todas = [];
    do {
        const r = await chamadaApi(
            '/monitorias/' + encodeURIComponent(disciplinaID) + '?limit=100&page=' + pagina
        );
        if (r.statusHttp >= 400) throw new Error(mensagemDaApi(r, 'Erro ao carregar monitorias.'));
        (r.monitorias || []).forEach((m) => todas.push(D.normalizarVaga(m)));
        totalPaginas = (r.paginacao && r.paginacao.totalPaginas) || 1;
        pagina++;
    } while (pagina <= totalPaginas && pagina <= 10);
    return todas;
}

// Inscrições do aluno, para marcar "Você já está inscrito" antes de ele tentar agendar.
// Se falhar, a tela segue sem a marcação: o backend continua barrando a duplicidade.
async function buscarSituacoes() {
    const situacoes = {};
    try {
        const r = await chamadaApi('/agendamentos?limit=100');
        (r.agendamentos || []).forEach((a) => {
            situacoes[a.id_monitoria] = a.status === 'cancelado' ? 'cancelado' : 'inscrito';
        });
    } catch {
        /* sem marcação */
    }
    return situacoes;
}

/** Vagas que ainda vão acontecer, em ordem, com a situação da inscrição do aluno. */
async function buscarTudo(perfil) {
    const [vagas, situacoes] = await Promise.all([
        buscarVagas(),
        perfil === 'aluno' ? buscarSituacoes() : Promise.resolve({})
    ]);
    return D.vagasFuturas(vagas, new Date()).map((v) =>
        situacoes[v.id] ? { ...v, situacao: situacoes[v.id] } : v
    );
}

function Campo({ id, rotulo, erro, dica, children }) {
    return (
        <div className={erro ? 'campo err' : 'campo'} data-campo={id}>
            <label htmlFor={'f-' + id}>{rotulo}</label>
            {children}
            <span className="dica" id={'d-' + id}>
                {erro || dica || ''}
            </span>
        </div>
    );
}

// Conteúdo do #app: no original, o que render() monta depois que a sessão chega
function Fluxo({ usuario, perfil }) {
    const { showToast } = useCasca();
    const [S, setS] = useState(estadoInicial);
    const mudar = (mudanca) => setS(redesenho(mudanca));

    // Foco a aplicar depois do próximo desenho: { seletor, suave }
    const foco = useRef(null);
    useEffect(() => {
        const pedido = foco.current;
        if (!pedido) return;
        foco.current = null;
        const el = document.querySelector(pedido.seletor);
        if (!el) return;
        if (pedido.suave) {
            el.focus({ preventScroll: true });
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            el.focus();
        }
    });
    function focar(seletor) {
        foco.current = { seletor, suave: true };
    }

    // Trava síncrona do envio (o S.enviando do original): o estado só muda no próximo desenho,
    // e um duplo clique rápido passaria pela checagem dele
    const enviando = useRef(false);

    const { tentativa } = S;
    useEffect(() => {
        let ativo = true;
        buscarTudo(perfil).then(
            (vagas) => {
                if (!ativo) return;
                setS(
                    redesenho((s) => {
                        let { ano, mes } = s;
                        // Aluno: se o mês atual não tem horários, abre no mês do próximo horário
                        if (perfil === 'aluno' && vagas.length) {
                            const temNoMes = vagas.some(
                                (v) => v.inicio.getMonth() === mes && v.inicio.getFullYear() === ano
                            );
                            if (!temNoMes) {
                                ano = vagas[0].inicio.getFullYear();
                                mes = vagas[0].inicio.getMonth();
                            }
                        }
                        return { vagas, ano, mes, carregando: false };
                    })
                );
            },
            (erro) => {
                if (!ativo) return;
                const erroCarga = erro.message || 'Não foi possível carregar as monitorias.';
                setS(redesenho(() => ({ erroCarga, carregando: false })));
                showToast(erroCarga, 'error', erro);
            }
        );
        return () => {
            ativo = false;
        };
    }, [perfil, showToast, tentativa]);

    // Trocar de largura no meio do fluxo mantém o progresso
    useEffect(() => {
        const aoMudar = () => {
            const desktop = largura.matches;
            setS(
                redesenho((s) =>
                    desktop
                        ? { desktop }
                        : {
                              desktop,
                              passo: s.dia ? 2 : 1,
                              m: { ...s.m, passo: s.form.dia ? 2 : 1 }
                          }
                )
            );
        };
        largura.addEventListener('change', aoMudar);
        return () => largura.removeEventListener('change', aoMudar);
    }, []);

    // --- 3. Consultas ---
    const minhas = S.vagas.filter((v) => v.idMonitor === Number(usuario.id));
    const doPerfil = perfil === 'monitor' ? minhas : S.vagas;
    const contagem = D.contarPorDia(doPerfil);
    const minhasNoDia = (k) => D.vagasDoDia(minhas, k);

    function rotuloQtd(n) {
        if (perfil === 'monitor')
            return n ? D.plural(n, 'vaga sua', 'vagas suas') : 'nenhuma vaga sua';
        return n ? D.plural(n, 'horário', 'horários') : 'sem horários';
    }

    async function agendar() {
        const vaga = S.vagas.find((v) => v.id === S.vagaId);
        if (!vaga || enviando.current) return;
        enviando.current = true;
        mudar(() => ({ enviando: true, erro: null }));
        let resultado;
        try {
            // Tarefa 31: só id_monitoria; o backend grava o horário da própria vaga
            const r = await chamadaApi('/agendamentos', {
                method: 'POST',
                body: JSON.stringify({ id_monitoria: vaga.id })
            });
            if (r.success) {
                resultado = (s) => ({
                    etapa: 'sucesso',
                    vagas: s.vagas.map((v) =>
                        v.id === vaga.id
                            ? { ...v, livres: Math.max(v.livres - 1, 0), situacao: 'inscrito' }
                            : v
                    )
                });
                showToast('Monitoria agendada com sucesso!', 'success');
            } else {
                const erro = mensagemDaApi(r, 'Não foi possível agendar.');
                resultado = (s) => ({
                    erro,
                    // 4xx: a vaga mudou (lotou, já inscrito, fechou); tentar de novo não resolve
                    erroDefinitivo: r.statusHttp >= 400 && r.statusHttp < 500,
                    vagas: s.vagas.map((v) =>
                        v.id === vaga.id
                            ? {
                                  ...v,
                                  livres: r.statusHttp === 409 ? 0 : v.livres,
                                  situacao: /inscrit/i.test(erro) ? 'inscrito' : v.situacao
                              }
                            : v
                    )
                });
                console.warn('[MoniPro] Agendamento recusado:', r);
            }
        } catch (erro) {
            resultado = () => ({ erro: SEM_CONEXAO, erroDefinitivo: false });
            console.error('[MoniPro]', erro);
        }
        // Só um dos dois existe depois do desenho: #sucesso se agendou, #revisao se não
        focar('#sucesso, #revisao');
        enviando.current = false;
        mudar((s) => ({ ...resultado(s), enviando: false }));
    }

    async function criarVaga() {
        const data = D.dataDoFormulario(S.form.dia, S.form.hora);
        if (!data || enviando.current) return;
        enviando.current = true;
        mudar(() => ({ enviando: true, erroForm: null }));
        let resultado;
        try {
            const r = await chamadaApi('/monitorias', {
                method: 'POST',
                body: JSON.stringify({
                    id_disciplina: Number(disciplinaID),
                    horario: data.toISOString(),
                    local: S.form.local.trim(),
                    descricao: S.form.descricao.trim(),
                    capacidade: Number(S.form.capacidade)
                })
            });
            if (r.success && r.monitoria) {
                const nova = D.normalizarVaga({
                    ...r.monitoria,
                    vagas_disponiveis: r.monitoria.capacidade,
                    monitor: { nome_completo: usuario.nome }
                });
                resultado = (s) => ({
                    vagas: [...s.vagas, nova].sort((a, b) => a.inicio - b.inicio),
                    criada: nova
                });
                showToast('Vaga de monitoria criada com sucesso!', 'success');
            } else {
                // Erro de validação volta para o formulário, junto do campo
                const errosApi = {};
                Object.entries(r.campos || {}).forEach(([campo, msg]) => {
                    if (CAMPOS_API[campo]) errosApi[CAMPOS_API[campo]] = msg;
                });
                const erroForm = mensagemDaApi(r, 'Não foi possível criar a vaga.');
                resultado = () => ({ errosApi, erroForm, m: { etapa: 'form', passo: 2 } });
                console.warn('[MoniPro] Vaga recusada:', r);
            }
        } catch (erro) {
            resultado = () => ({ erroForm: SEM_CONEXAO });
            console.error('[MoniPro]', erro);
        }
        // Só um dos três existe depois do desenho: #sucesso se criou; senão a revisão, se a
        // etapa ainda é ela, ou o erro no alto do formulário
        focar('#sucesso, #revisao-vaga, #erro-form');
        enviando.current = false;
        mudar((s) => ({ ...resultado(s), enviando: false }));
    }

    // --- 8. Eventos ---
    function escolherDia(k, ev) {
        const desktop = largura.matches;
        if (perfil === 'monitor')
            mudar((s) => ({
                form: { ...s.form, dia: k },
                errosApi: {},
                erroForm: null,
                m: { etapa: 'form', passo: desktop ? s.m.passo : 2 }
            }));
        else mudar((s) => ({ dia: k, vagaId: null, passo: desktop ? s.passo : 2 }));
        if (desktop) ev.currentTarget.focus({ preventScroll: true });
    }

    // Calendário pelo teclado: setas mudam o dia, Home/End vão ao início/fim da semana
    function teclaNoCalendario(ev) {
        const botao = ev.target.closest('.dia');
        if (!botao) return;
        const data = D.deChave(botao.dataset.dia);
        // Mês em exibição durante a busca (o original redesenha o calendário a cada virada)
        let { ano, mes } = S;
        let achou = null;
        const noMes = () => data.getMonth() === mes && data.getFullYear() === ano;
        const bloqueado = () =>
            D.diaPassado(data, new Date()) || (perfil !== 'monitor' && !contagem[D.chave(data)]);

        function moverFoco(ajuste) {
            if (!noMes()) {
                ano = data.getFullYear();
                mes = data.getMonth();
            }
            let existe = true;
            for (let i = 0; i < 6 && ajuste && existe && bloqueado(); i++) {
                data.setDate(data.getDate() + ajuste);
                existe = noMes();
            }
            if (!existe || bloqueado()) return false;
            achou = D.chave(data);
            return true;
        }

        if (ev.key === 'Home' || ev.key === 'End') {
            ev.preventDefault();
            const inicio = ev.key === 'Home';
            data.setDate(data.getDate() + (inicio ? -data.getDay() : 6 - data.getDay()));
            moverFoco(inicio ? 1 : -1);
        } else {
            const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
            if (!passo) return;
            ev.preventDefault();
            for (let i = 0; i < 62; i++) {
                data.setDate(data.getDate() + passo);
                if (moverFoco(0)) break;
                if (passo < 0 && D.diaPassado(data, new Date())) break;
            }
        }

        if (achou) foco.current = { seletor: '.dia[data-dia="' + achou + '"]', suave: false };
        if (ano !== S.ano || mes !== S.mes) mudar(() => ({ ano, mes, focoDia: achou }));
        else if (achou) setS((s) => ({ ...s, focoDia: achou }));
    }

    // Digitar no formulário não é um render() do original: o calendário fica como está
    function digitar(nome, valor) {
        const agora = new Date();
        setS((s) => {
            const errosApi = { ...s.errosApi };
            delete errosApi[nome];
            return {
                ...s,
                agora,
                form: { ...s.form, [nome]: valor },
                tocados: { ...s.tocados, [nome]: true },
                errosApi
            };
        });
    }

    // Sair de um campo vazio obrigatório também conta como "usado" e mostra o erro
    function tocar(nome) {
        const agora = new Date();
        setS((s) => ({ ...s, agora, tocados: { ...s.tocados, [nome]: true } }));
    }

    // --- 5. Partes comuns ---
    function calendario(selecionado) {
        const noMes = doPerfil.filter(
            (v) => v.inicio.getMonth() === S.mes && v.inicio.getFullYear() === S.ano
        );
        const diasNoMes = new Set(noMes.map((v) => D.chave(v.inicio))).size;
        let resumo;
        if (!noMes.length)
            resumo =
                perfil === 'monitor' ? 'Nenhuma vaga sua neste mês' : 'Nenhum horário neste mês';
        else
            resumo = (
                <>
                    <b>{noMes.length}</b>
                    {' ' +
                        (perfil === 'monitor'
                            ? noMes.length === 1
                                ? 'vaga sua'
                                : 'vagas suas'
                            : noMes.length === 1
                              ? 'horário'
                              : 'horários') +
                        ' em '}
                    <b>{diasNoMes}</b>
                    {' ' + (diasNoMes === 1 ? 'dia' : 'dias')}
                </>
            );
        return (
            <Calendario
                ano={S.ano}
                mes={S.mes}
                agora={S.agora}
                selecionado={selecionado}
                contagem={contagem}
                aceitaDiaVazio={perfil === 'monitor'}
                rotuloQtd={rotuloQtd}
                legenda={perfil === 'monitor' ? 'Com vagas suas' : 'Com horários'}
                resumo={resumo}
                focoDia={S.focoDia}
                aoMudarMes={(delta) => mudar((s) => D.mesVizinho(s.ano, s.mes, delta))}
                aoEscolherDia={escolherDia}
                aoTeclar={teclaNoCalendario}
            />
        );
    }

    function erroCarga() {
        return (
            <div className="vazio" role="alert">
                <p>{S.erroCarga}</p>
                <button
                    type="button"
                    className="btn sec"
                    data-acao="recarregar"
                    onClick={() =>
                        mudar((s) => ({
                            carregando: true,
                            erroCarga: null,
                            tentativa: s.tentativa + 1
                        }))
                    }
                >
                    Tentar de novo
                </button>
            </div>
        );
    }

    // --- 6. Aluno ---
    function revisar() {
        focar('#revisao');
        mudar(() => ({ etapa: 'revisao', erro: null }));
    }

    function lista(semTitulo) {
        if (!S.dia) return <p className="vazio">Selecione um dia disponível (marcado em azul).</p>;
        const vagas = D.vagasDoDia(S.vagas, S.dia);
        if (!vagas.length)
            return <p className="vazio">Nenhuma monitoria encontrada para este dia.</p>;
        return (
            <div className="lista" aria-live="polite">
                {semTitulo ? null : (
                    <p className="rotulo">
                        {D.diaLongo(D.deChave(S.dia)) +
                            ' · ' +
                            D.plural(vagas.length, 'horário', 'horários')}
                    </p>
                )}
                <div className="lista-itens">
                    {vagas.map((v) => (
                        <VagaBotao
                            key={v.id}
                            vaga={v}
                            selecionada={v.id === S.vagaId}
                            aoEscolher={() => mudar(() => ({ vagaId: v.id }))}
                        />
                    ))}
                </div>
            </div>
        );
    }

    function revisao() {
        const v = S.vagas.find((x) => x.id === S.vagaId);
        if (!v) return null;
        const prazo = D.prazoCancelamento(v.inicio);
        const prazoTexto =
            prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
            ' às ' +
            D.hora(prazo);
        const definitivo = S.erro && S.erroDefinitivo;
        const voltar = () =>
            mudar((s) => ({
                vagaId: s.erroDefinitivo ? null : s.vagaId,
                erro: null,
                erroDefinitivo: false,
                etapa: 'escolha',
                passo: 2
            }));
        return (
            <section className="revisao" id="revisao" tabIndex={-1} aria-labelledby="rev-titulo">
                <p className="rotulo" id="rev-titulo">
                    Revise antes de confirmar
                </p>
                {S.erro ? (
                    <p className="erro" role="alert">
                        {S.erro}
                    </p>
                ) : null}
                <dl>
                    <LinhaResumo rotulo="Disciplina" icone="livro" valor={disciplinaNome} />
                    <LinhaResumo rotulo="Monitor" icone="pessoa" valor={v.monitor} />
                    <LinhaResumo rotulo="Dia" icone="calendario" valor={D.diaLongo(v.inicio)} />
                    <LinhaResumo rotulo="Horário" icone="relogio" valor={D.hora(v.inicio)} />
                    <LinhaResumo rotulo="Local" icone="local" valor={v.local || 'A definir'} />
                    {v.descricao ? (
                        <LinhaResumo rotulo="Assunto" icone="assunto" valor={v.descricao} />
                    ) : null}
                    <LinhaResumo
                        rotulo="Lugares"
                        icone="pessoas"
                        valor={v.livres + ' de ' + v.capacidade + ' livres'}
                    />
                </dl>
                {definitivo ? null : (
                    <p className="aviso">
                        {'Você pode cancelar até ' + prazoTexto + ' (24h antes do horário).'}
                    </p>
                )}
                {definitivo ? (
                    <div className="linha acoes">
                        <button type="button" className="btn" data-acao="voltar" onClick={voltar}>
                            Ver outros horários
                        </button>
                    </div>
                ) : (
                    <div className="linha acoes">
                        <button
                            type="button"
                            className="btn sec"
                            data-acao="voltar"
                            onClick={voltar}
                        >
                            Trocar horário
                        </button>
                        <button
                            type="button"
                            className="btn"
                            data-acao="confirmar"
                            disabled={S.enviando}
                            aria-busy={S.enviando ? 'true' : undefined}
                            onClick={agendar}
                        >
                            {S.enviando ? (
                                'Agendando…'
                            ) : (
                                <>
                                    <Icone nome="agendar" tamanho={20} />
                                    Confirmar agendamento
                                </>
                            )}
                        </button>
                    </div>
                )}
            </section>
        );
    }

    function sucessoAluno() {
        const v = S.vagas.find((x) => x.id === S.vagaId);
        return (
            <section className="sucesso" id="sucesso" tabIndex={-1}>
                <span className="ok-icone">
                    <Icone nome="ok" tamanho={28} traco={3} />
                </span>
                <h2>Monitoria agendada!</h2>
                <p>
                    {v.monitor + ' · ' + D.diaLongo(v.inicio) + ' às ' + D.hora(v.inicio)}
                    <br />
                    {v.local || 'Local a definir'}
                </p>
                <div className="linha">
                    <button
                        type="button"
                        className="btn sec"
                        data-acao="novo"
                        onClick={() =>
                            mudar((s) => ({ etapa: 'escolha', vagaId: null, passo: s.dia ? 2 : 1 }))
                        }
                    >
                        Agendar outra
                    </button>
                    <a className="btn" href="perfil_aluno.html">
                        Ver no meu perfil
                    </a>
                </div>
            </section>
        );
    }

    function telaAluno() {
        if (S.carregando) return <Carregando texto="Carregando horários…" />;
        if (S.erroCarga) return erroCarga();
        if (S.etapa === 'sucesso') return sucessoAluno();
        if (!S.vagas.length)
            return (
                <p className="vazio">Ainda não há horários de monitoria para esta disciplina.</p>
            );
        if (S.desktop)
            return (
                <div className="colunas">
                    <div className="col">
                        <h2 className="area-titulo">Dias disponíveis</h2>
                        {calendario(S.dia)}
                    </div>
                    <div className="col col-dir">
                        {S.etapa === 'revisao' ? (
                            revisao()
                        ) : (
                            <>
                                <h2 className="area-titulo">Monitores disponíveis</h2>
                                {lista(false)}
                                <button
                                    type="button"
                                    className="btn"
                                    data-acao="revisar"
                                    disabled={!S.vagaId}
                                    onClick={revisar}
                                >
                                    <Icone nome="agendar" tamanho={20} />
                                    Agendar monitoria
                                </button>
                            </>
                        )}
                    </div>
                </div>
            );
        let passo = S.etapa === 'revisao' ? 3 : S.passo;
        if (passo === 2 && !S.dia) passo = 1;
        return (
            <div className="colunas">
                <Passos nomes={PASSOS_ALUNO} atual={passo} />
                {passo === 1 ? (
                    calendario(S.dia)
                ) : passo === 2 ? (
                    <>
                        <DiaSelecionado
                            dia={S.dia}
                            acao="passo"
                            aoTrocar={() => mudar(() => ({ passo: 1 }))}
                        />
                        {lista(true)}
                        <div className="linha acoes">
                            <button
                                type="button"
                                className="btn sec"
                                data-acao="passo"
                                data-passo="1"
                                onClick={() => mudar(() => ({ passo: 1 }))}
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                className="btn"
                                data-acao="revisar"
                                disabled={!S.vagaId}
                                onClick={revisar}
                            >
                                Continuar
                            </button>
                        </div>
                    </>
                ) : (
                    revisao()
                )}
            </div>
        );
    }

    // --- 7. Monitor ---
    const errosForm = {
        ...D.validarVaga(S.form, S.agora, minhasNoDia(S.form.dia)),
        ...S.errosApi
    };

    function vagaDoForm() {
        const inicio = D.dataDoFormulario(S.form.dia, S.form.hora);
        if (!inicio) return null;
        const capacidade = Math.max(Math.floor(Number(S.form.capacidade)) || 1, 1);
        return {
            inicio,
            monitor: usuario.nome || 'Você',
            local: S.form.local.trim(),
            descricao: S.form.descricao.trim(),
            capacidade,
            livres: capacidade
        };
    }

    function previa() {
        const v = vagaDoForm();
        let corpo;
        if (!v) corpo = <p className="vazio">Escolha um dia para ver a prévia.</p>;
        // Sem horário o card mostraria "00:00"
        else if (!S.form.hora)
            corpo = <p className="vazio">Escolha o horário para ver a prévia.</p>;
        else corpo = <VagaEstatica vaga={v} />;
        return (
            <>
                <p className="rotulo">
                    <Icone nome="olho" tamanho={14} />
                    Prévia: como o aluno vai ver
                </p>
                {corpo}
            </>
        );
    }

    function campos() {
        const f = S.form;
        // Erro só aparece no campo depois que ele foi usado (ou quando veio da API); o botão
        // "Revisar vaga" continua desativado enquanto qualquer campo for inválido.
        const e = {};
        Object.keys(errosForm).forEach((campo) => {
            if (S.tocados[campo] || S.errosApi[campo]) e[campo] = errosForm[campo];
        });
        const controle = (id) => ({
            id: 'f-' + id,
            value: f[id],
            'aria-describedby': 'd-' + id,
            'aria-invalid': e[id] ? 'true' : undefined,
            onChange: (ev) => digitar(id, ev.target.value),
            onBlur: () => tocar(id)
        });
        return (
            <div className="form">
                {S.erroForm ? (
                    <p className="erro" id="erro-form" tabIndex={-1} role="alert">
                        {S.erroForm}
                    </p>
                ) : null}
                <div className="dois">
                    <Campo id="hora" rotulo="Horário" erro={e.hora} dica={DICAS.hora}>
                        <CampoHora
                            atual={f.hora}
                            ocupados={minhasNoDia(f.dia).map((v) => D.hora(v.inicio))}
                            invalido={Boolean(e.hora)}
                            aoEscolher={(h) => digitar('hora', h)}
                            aoSair={() => tocar('hora')}
                        />
                    </Campo>
                    <Campo
                        id="capacidade"
                        rotulo="Lugares"
                        erro={e.capacidade}
                        dica={DICAS.capacidade}
                    >
                        <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            {...controle('capacidade')}
                        />
                    </Campo>
                </div>
                <Campo id="local" rotulo="Local" erro={e.local} dica={DICAS.local}>
                    <input
                        type="text"
                        maxLength={140}
                        autoComplete="off"
                        placeholder="Laboratório 3, Bloco C"
                        {...controle('local')}
                    />
                </Campo>
                <Campo
                    id="descricao"
                    rotulo="Assunto (opcional)"
                    erro={e.descricao}
                    dica={f.descricao.length + '/' + D.LIMITE_DESCRICAO}
                >
                    <textarea
                        rows={2}
                        placeholder="Ex.: Foco em SQL Joins"
                        {...controle('descricao')}
                    />
                </Campo>
                <div className="previa" id="previa">
                    {previa()}
                </div>
            </div>
        );
    }

    function minhasVagas(k) {
        const vagas = minhasNoDia(k);
        return (
            <div className="minhas">
                <p className="rotulo">Suas vagas neste dia</p>
                {vagas.length ? (
                    <ul>
                        {vagas.map((v) => (
                            <li key={v.id} className="minha">
                                <span className="h">
                                    <Icone nome="relogio" tamanho={13} />
                                    {D.hora(v.inicio)}
                                </span>
                                <span className="l">
                                    <Icone nome="local" tamanho={13} />
                                    {v.local || 'A definir'}
                                </span>
                                <span className={v.livres <= 0 ? 'chip bad' : 'chip info'}>
                                    <Icone nome="pessoas" tamanho={12} />
                                    {v.capacidade - v.livres + ' de ' + v.capacidade + ' inscritos'}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="nada">Nenhuma vaga sua neste dia.</p>
                )}
            </div>
        );
    }

    function botaoRevisarVaga() {
        return (
            <button
                type="button"
                className="btn"
                id="btn-revisar-vaga"
                data-acao="m-revisar"
                disabled={Object.keys(errosForm).length > 0}
                onClick={() => {
                    focar('#revisao-vaga');
                    mudar((s) => ({ m: { ...s.m, etapa: 'revisao' } }));
                }}
            >
                Revisar vaga
            </button>
        );
    }

    function revisaoVaga() {
        const v = vagaDoForm();
        if (!v) return null;
        return (
            <section
                className="revisao"
                id="revisao-vaga"
                tabIndex={-1}
                aria-labelledby="revv-titulo"
            >
                <p className="rotulo" id="revv-titulo">
                    Revise a vaga antes de criar
                </p>
                <dl>
                    <LinhaResumo rotulo="Disciplina" icone="livro" valor={disciplinaNome} />
                    <LinhaResumo rotulo="Dia" icone="calendario" valor={D.diaLongo(v.inicio)} />
                    <LinhaResumo rotulo="Horário" icone="relogio" valor={D.hora(v.inicio)} />
                    <LinhaResumo rotulo="Local" icone="local" valor={v.local} />
                    {v.descricao ? (
                        <LinhaResumo rotulo="Assunto" icone="assunto" valor={v.descricao} />
                    ) : null}
                    <LinhaResumo
                        rotulo="Lugares"
                        icone="pessoas"
                        valor={D.plural(v.capacidade, 'aluno', 'alunos')}
                    />
                </dl>
                <div className="previa">
                    <p className="rotulo">
                        <Icone nome="olho" tamanho={14} />
                        Como o aluno vai ver
                    </p>
                    <VagaEstatica vaga={v} />
                </div>
                <p className="aviso">
                    Depois de criada, a vaga só pode ser cancelada até 24h antes do horário.
                </p>
                <div className="linha acoes">
                    <button
                        type="button"
                        className="btn sec"
                        data-acao="m-editar"
                        onClick={() => mudar(() => ({ m: { etapa: 'form', passo: 2 } }))}
                    >
                        Editar
                    </button>
                    <button
                        type="button"
                        className="btn"
                        data-acao="criar"
                        disabled={S.enviando}
                        aria-busy={S.enviando ? 'true' : undefined}
                        onClick={criarVaga}
                    >
                        {S.enviando ? (
                            'Criando vaga…'
                        ) : (
                            <>
                                <Icone nome="criar" tamanho={20} />
                                Criar vaga
                            </>
                        )}
                    </button>
                </div>
            </section>
        );
    }

    function sucessoMonitor() {
        const v = S.criada;
        return (
            <section className="sucesso" id="sucesso" tabIndex={-1}>
                <span className="ok-icone">
                    <Icone nome="ok" tamanho={28} traco={3} />
                </span>
                <h2>Vaga criada!</h2>
                <p>
                    {D.diaLongo(v.inicio) + ' às ' + D.hora(v.inicio) + ' · ' + v.local}
                    <br />
                    {'Os alunos de ' + disciplinaNome + ' já podem agendar.'}
                </p>
                <div className="linha">
                    <button
                        type="button"
                        className="btn sec"
                        data-acao="nova-vaga"
                        onClick={() =>
                            mudar(() => ({
                                criada: null,
                                m: { passo: 2, etapa: 'form' },
                                tocados: {}
                            }))
                        }
                    >
                        Criar outra
                    </button>
                    <a className="btn" href="perfil_monitor.html">
                        Ver minhas vagas
                    </a>
                </div>
            </section>
        );
    }

    function telaMonitor() {
        if (S.carregando) return <Carregando texto="Carregando suas vagas…" />;
        if (S.erroCarga) return erroCarga();
        if (S.criada) return sucessoMonitor();
        const mPasso = (passo) => mudar(() => ({ m: { passo, etapa: 'form' } }));
        if (S.desktop)
            return (
                <div className="colunas">
                    <div className="col">
                        <h2 className="area-titulo">Dia da vaga</h2>
                        {calendario(S.form.dia)}
                    </div>
                    <div className="col col-dir">
                        {S.m.etapa === 'revisao' ? (
                            revisaoVaga()
                        ) : S.form.dia ? (
                            <>
                                <h2 className="area-titulo">
                                    {'Nova vaga · ' + D.diaCurto(D.deChave(S.form.dia))}
                                </h2>
                                {minhasVagas(S.form.dia)}
                                {campos()}
                                {botaoRevisarVaga()}
                            </>
                        ) : (
                            <>
                                <h2 className="area-titulo">Nova vaga</h2>
                                <p className="vazio">Escolha um dia no calendário para começar.</p>
                            </>
                        )}
                    </div>
                </div>
            );
        let passo = S.m.etapa === 'revisao' ? 3 : S.m.passo;
        if (passo > 1 && !S.form.dia) passo = 1;
        return (
            <div className="colunas">
                <Passos nomes={PASSOS_MONITOR} atual={passo} />
                {passo === 1 ? (
                    <>
                        {calendario(S.form.dia)}
                        {S.form.dia ? (
                            <div className="linha acoes">
                                <button
                                    type="button"
                                    className="btn"
                                    data-acao="m-passo"
                                    data-passo="2"
                                    onClick={() => mPasso(2)}
                                >
                                    Continuar
                                </button>
                            </div>
                        ) : null}
                    </>
                ) : passo === 2 ? (
                    <>
                        <DiaSelecionado
                            dia={S.form.dia}
                            acao="m-passo"
                            aoTrocar={() => mPasso(1)}
                        />
                        {minhasVagas(S.form.dia)}
                        {campos()}
                        <div className="linha acoes">
                            <button
                                type="button"
                                className="btn sec"
                                data-acao="m-passo"
                                data-passo="1"
                                onClick={() => mPasso(1)}
                            >
                                Voltar
                            </button>
                            {botaoRevisarVaga()}
                        </div>
                    </>
                ) : (
                    revisaoVaga()
                )}
            </div>
        );
    }

    return perfil === 'monitor' ? telaMonitor() : telaAluno();
}

function Marcar() {
    const { showToast } = useCasca();
    // Enquanto a sessão não chega fica como no HTML original: título "Monitoria" e #app vazio
    const [usuario, setUsuario] = useState(null);

    useEffect(() => {
        if (!disciplinaID) {
            showToast('Informações inválidas. Redirecionando...', 'error');
            const timer = setTimeout(() => {
                window.location.href = 'base.html';
            }, 1500);
            return () => clearTimeout(timer);
        }

        // P3 (R7): quem está logado vem de GET /auth/sessao (o token fica no cookie httpOnly)
        let ativo = true;
        obterSessao().then(
            (user) => {
                if (!ativo) return;
                if (!user) {
                    window.location.href = 'index.html';
                    return;
                }
                document.title = 'Monitoria de ' + disciplinaNome + ' - MoniPro';
                setUsuario(user);
            },
            (erro) => {
                if (!ativo) return;
                showToast(erro.message || 'Falha na comunicação com o servidor.', 'error', erro);
            }
        );
        return () => {
            ativo = false;
        };
    }, [showToast]);

    const perfil = usuario && usuario.tipo === 'monitor' ? 'monitor' : 'aluno';

    return (
        <>
            <main className="pagina-marcar">
                <div className="cartao">
                    <div className="titulo">
                        <button
                            type="button"
                            className="btn-voltar"
                            aria-label="Voltar para a lista de disciplinas"
                            onClick={() => history.back()}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
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
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Voltar
                        </button>
                        <h1 id="titulo-pagina">
                            {usuario ? 'Monitoria de ' + disciplinaNome : 'Monitoria'}
                        </h1>
                        <p id="subtitulo">
                            {usuario
                                ? perfil === 'monitor'
                                    ? 'Crie uma vaga: dia, horário, local e lugares'
                                    : 'Escolha um dia e um horário'
                                : null}
                        </p>
                    </div>
                    {/* Aluno: agendar; monitor: criar vaga */}
                    <div id="app">
                        {usuario ? <Fluxo usuario={usuario} perfil={perfil} /> : null}
                    </div>
                    <div className="fim-cartao"></div>
                </div>
            </main>
            <footer className="rodape-legal">
                <a href="privacidade.html">Aviso de Privacidade</a>
            </footer>
        </>
    );
}

export default function MarcarMonitoria() {
    return (
        <Casca>
            <Marcar />
        </Casca>
    );
}
