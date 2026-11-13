// Tela "Nova disciplina": porte de Monipro_web/cadastro_disciplina.html +
// JS/disciplina/cadastro.js. Só monitores chegam aqui pelo botão de Minhas Disciplinas; quem
// abre o endereço direto sem ser monitor volta para a lista.
// Cabeçalho, menu lateral, aviso de sair e toast vêm da Casca.
import { useCallback, useEffect, useRef, useState } from 'react';
// Mesmos arquivos e mesma ordem dos <link> do original (o base.css vem da Casca)
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import Casca, { useCasca } from '../Casca.jsx';
import '../../../Monipro_web/CSS/escolha_disciplina.css';
import '../../../Monipro_web/CSS/cadastro_disciplina.css';
import { chamadaApi, mensagemDaApi, obterSessao } from '../api.js';
import { NOME_MAXIMO, acharRepetida, limpar, ordenar, validarNome } from '../disciplinaRegras.js';

const LISTA = 'escolha_disciplina.html';

const propsIcone = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
};

function Formulario() {
    const { showToast } = useCasca();
    // O formulário fica escondido até a sessão confirmar que quem abriu é monitor
    const [autorizado, setAutorizado] = useState(false);
    const [nome, setNome] = useState('');
    const [erro, setErro] = useState('');
    const [existentes, setExistentes] = useState([]);
    const [falhaLista, setFalhaLista] = useState(false);
    const [enviando, setEnviando] = useState(false);
    // Trava síncrona do envio: o estado só muda no próximo desenho, e um duplo clique rápido
    // passaria pela checagem dele
    const travaEnvio = useRef(false);
    const input = useRef(null);

    const sessaoExpirada = useCallback(() => {
        showToast('Sua sessão expirou. Entre de novo.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }, [showToast]);

    // Lista para o aviso de repetida (se falhar, a tela funciona sem o aviso)
    const carregarExistentes = useCallback(async () => {
        try {
            const r = await chamadaApi('/disciplinas');
            if (r.statusHttp === 401) {
                sessaoExpirada();
                return;
            }
            if (r.statusHttp >= 400) throw new Error(mensagemDaApi(r, 'Erro ao listar.'));
            setExistentes(Array.isArray(r.disciplinas) ? r.disciplinas : []);
            setFalhaLista(false);
        } catch (e) {
            console.warn('[MoniPro] Lista de disciplinas indisponível:', e.message);
            setFalhaLista(true);
        }
    }, [sessaoExpirada]);

    // P3 (R7): o perfil vem de GET /auth/sessao (só decide o que mostrar; quem barra é a API)
    useEffect(() => {
        let ativo = true;
        obterSessao().then(
            (usuario) => {
                if (!ativo) return;
                if (!usuario) {
                    window.location.href = 'index.html';
                    return;
                }
                if (String(usuario.tipo || '').toLowerCase() !== 'monitor') {
                    showToast('Apenas monitores podem cadastrar disciplinas.', 'error');
                    setTimeout(() => {
                        window.location.href = LISTA;
                    }, 1500);
                    return;
                }
                setAutorizado(true);
                carregarExistentes();
            },
            (falha) => {
                if (!ativo) return;
                showToast(falha.message || 'Falha na comunicação com o servidor.', 'error', falha);
            }
        );
        return () => {
            ativo = false;
        };
    }, [showToast, carregarExistentes]);

    useEffect(() => {
        if (autorizado) input.current.focus();
    }, [autorizado]);

    function aoDigitar(evento) {
        setErro('');
        // Como no original: digitar redesenha o título com a contagem, mesmo depois de uma falha
        setFalhaLista(false);
        setNome(evento.target.value);
    }

    async function aoEnviar(evento) {
        evento.preventDefault();
        if (travaEnvio.current) return;

        const limpo = limpar(nome);
        const invalido = validarNome(limpo);
        if (invalido) {
            setErro(invalido);
            input.current.focus();
            return;
        }

        setErro('');
        travaEnvio.current = true;
        setEnviando(true);
        let r;
        try {
            r = await chamadaApi('/disciplinas', {
                method: 'POST',
                body: JSON.stringify({ nome: limpo })
            });
        } catch (e) {
            travaEnvio.current = false;
            setEnviando(false);
            showToast('Não foi possível conectar ao servidor.', 'error', e);
            return;
        }

        if (r.statusHttp === 201 && r.disciplina) {
            showToast('Disciplina criada com sucesso.', 'success');
            const { id, nome: salvo } = r.disciplina;
            // Segue para criar a primeira vaga da disciplina nova (o botão continua desativado)
            setTimeout(() => {
                window.location.href =
                    'marcar_monitoria.html?disciplinaID=' +
                    encodeURIComponent(id) +
                    '&disciplinaNome=' +
                    encodeURIComponent(salvo);
            }, 800);
            return;
        }

        travaEnvio.current = false;
        setEnviando(false);
        if (r.statusHttp === 401) {
            sessaoExpirada();
            return;
        }
        if (r.statusHttp === 403) {
            showToast(mensagemDaApi(r, 'Apenas monitores podem cadastrar disciplinas.'), 'error');
            return;
        }
        // 400 e 409: a mensagem fica junto ao campo, que não some como o toast
        setErro((r.campos && r.campos.nome) || mensagemDaApi(r, 'Não foi possível cadastrar.'));
        input.current.focus();
        // Outro monitor pode ter cadastrado no meio tempo: atualiza a lista do aviso
        if (r.statusHttp === 409) carregarExistentes();
    }

    const repetida = acharRepetida(existentes, nome);

    return (
        <>
            <main className="dashboard-wrapper">
                <div className="dashboard-container cadastro-disciplina">
                    <div className="page-header">
                        <div className="title-area">
                            <a
                                href={LISTA}
                                className="btn-voltar"
                                aria-label="Voltar para Minhas Disciplinas"
                            >
                                <svg {...propsIcone} width="18" height="18" strokeWidth={2.5}>
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                                Voltar
                            </a>
                            <h1>Nova disciplina</h1>
                            <p>Cadastre uma disciplina para abrir vagas de monitoria.</p>
                        </div>
                    </div>

                    <form
                        id="form-disciplina"
                        className="cd-cartao"
                        noValidate
                        hidden={!autorizado}
                        onSubmit={aoEnviar}
                    >
                        <div className="cd-campo">
                            <label htmlFor="nome-disciplina">
                                Nome da disciplina{' '}
                                <span className="cd-obrigatorio" aria-hidden="true">
                                    *
                                </span>
                            </label>
                            <div
                                className={erro ? 'cd-caixa invalido' : 'cd-caixa'}
                                id="caixa-nome"
                            >
                                <input
                                    ref={input}
                                    id="nome-disciplina"
                                    name="nome"
                                    type="text"
                                    maxLength={NOME_MAXIMO}
                                    required
                                    placeholder="Ex.: Cálculo I"
                                    autoComplete="off"
                                    aria-describedby="erro-nome contador-nome aviso-repetida"
                                    aria-invalid={erro ? 'true' : undefined}
                                    value={nome}
                                    onChange={aoDigitar}
                                />
                            </div>
                            <div className="cd-rodape-campo">
                                <p id="erro-nome" className="cd-erro" role="alert">
                                    {erro}
                                </p>
                                <span
                                    id="contador-nome"
                                    className={
                                        nome.length >= NOME_MAXIMO - 5
                                            ? 'cd-contador perto-do-limite'
                                            : 'cd-contador'
                                    }
                                >
                                    {/* Um nó de texto só, como no original: em três nós ("0", "/",
                                    "80") o navegador mede a largura com diferença de subpixel */}
                                    {`${nome.length}/${NOME_MAXIMO}`}
                                </span>
                            </div>
                            <div className="cd-aviso" id="aviso-repetida" hidden={!repetida}>
                                <svg {...propsIcone} width="16" height="16" strokeWidth={2.2}>
                                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <span id="aviso-repetida-texto">
                                    {repetida ? `Já existe: ${repetida.nome}` : ''}
                                </span>
                            </div>
                        </div>

                        <div className="cd-existentes">
                            <h2 id="titulo-existentes">
                                {falhaLista
                                    ? 'Não foi possível carregar as disciplinas já cadastradas.'
                                    : `Disciplinas já cadastradas (${existentes.length})`}
                            </h2>
                            <ul
                                className="cd-tags"
                                id="tags-existentes"
                                aria-labelledby="titulo-existentes"
                            >
                                {ordenar(existentes).map((d) => (
                                    <li
                                        key={d.id}
                                        className={
                                            repetida && d.id === repetida.id
                                                ? 'repetida'
                                                : undefined
                                        }
                                    >
                                        {d.nome}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="cd-acoes">
                            <a href={LISTA} className="cd-botao cd-botao-secundario">
                                Voltar
                            </a>
                            <button
                                type="submit"
                                className="cd-botao"
                                id="btn-cadastrar"
                                disabled={enviando}
                                aria-busy={enviando}
                            >
                                {enviando ? (
                                    <>
                                        <span className="giro" aria-hidden="true"></span>
                                        Cadastrando…
                                    </>
                                ) : (
                                    'Cadastrar'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
            <footer className="rodape-legal">
                <a href="privacidade.html">Aviso de Privacidade</a>
            </footer>
        </>
    );
}

export default function CadastroDisciplina() {
    return (
        <Casca>
            <Formulario />
        </Casca>
    );
}
