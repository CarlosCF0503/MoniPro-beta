// Recuperar senha: porte de Monipro_web/redefinir_senha.html + JS/redefinir_senha.js (o botão
// de olho vinha de JS/login.js). Sem token na URL: pede o link (POST /auth/senha/esqueci), e a
// resposta é sempre a mesma, exista a conta ou não. Com ?token=: cria a senha nova
// (POST /auth/senha/redefinir).
import { useEffect, useRef, useState } from 'react';
// Mesmos arquivos e mesma ordem dos <link> do redefinir_senha.html original
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import '../../../Monipro_web/CSS/login.css';
import '../../../Monipro_web/CSS/redefinir_senha.css';
import logo from '../../../Monipro_web/IMG/MoniPro-Logo.png';
import { chamadaApi, mensagemDaApi } from '../api.js';

const propsIcone = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
};

// Ícones grandes das caixas de resposta (sem xmlns, como no original)
const propsIconeCaixa = { ...propsIcone, xmlns: undefined, width: 30, height: 30 };

// Mesmas regras do cadastro
const REGRAS = [
    { id: 'tam', texto: 'Pelo menos 8 caracteres', ok: (s) => s.length >= 8 },
    { id: 'letra', texto: 'Pelo menos uma letra', ok: (s) => /\p{L}/u.test(s) },
    { id: 'num', texto: 'Pelo menos um número', ok: (s) => /\d/.test(s) }
];

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERRO_CONEXAO = 'Não foi possível conectar ao servidor. Tente de novo.';

function IconeEmail(props) {
    return (
        <svg {...props}>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    );
}

function IconeCadeado() {
    return (
        <div className="icone">
            <svg {...propsIcone}>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        </div>
    );
}

export default function RedefinirSenha() {
    // O token só vive na memória da tela: não vai para console nem para o armazenamento
    const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
    const [etapa, setEtapa] = useState(token ? 'etapa-nova' : 'etapa-pedir');
    const [emailEnviado, setEmailEnviado] = useState('');
    const [erroPedir, setErroPedir] = useState('');
    const [enviandoLink, setEnviandoLink] = useState(false);
    const [senha, setSenha] = useState('');
    const [senhaVisivel, setSenhaVisivel] = useState(false);
    const [erroNova, setErroNova] = useState('');
    const [salvando, setSalvando] = useState(false);
    // Trava síncrona do envio (no original o botão era desativado na hora)
    const travaEnvio = useRef(false);
    const inputEmail = useRef(null);
    const inputConfirma = useRef(null);
    // Caixas com tabindex="-1": recebem o foco quando aparecem
    const caixaEnviado = useRef(null);
    const caixaFeito = useRef(null);
    const caixaInvalido = useRef(null);

    // Tira o token da barra de endereço (e do histórico) assim que ele é lido. Se o navegador
    // recusar (página sem endereço próprio), a tela segue normalmente.
    useEffect(() => {
        if (!token) return;
        try {
            window.history.replaceState(null, '', window.location.pathname);
        } catch {
            // sem efeito: o token só continua visível na barra
        }
    }, [token]);

    useEffect(() => {
        const caixa = {
            'etapa-enviado': caixaEnviado,
            'etapa-feito': caixaFeito,
            'etapa-invalido': caixaInvalido
        }[etapa];
        caixa?.current.focus();
    }, [etapa]);

    async function aoPedir(ev) {
        ev.preventDefault();
        if (travaEnvio.current) return;
        const campos = ev.currentTarget.elements;
        const email = campos.inputEmail.value.trim();
        setErroPedir('');
        if (!EMAIL_VALIDO.test(email)) {
            setErroPedir('Digite um e-mail válido, como nome@exemplo.edu.br.');
            inputEmail.current.focus();
            return;
        }
        travaEnvio.current = true;
        setEnviandoLink(true);
        try {
            const r = await chamadaApi('/auth/senha/esqueci', {
                method: 'POST',
                body: JSON.stringify({ email, tipo_usuario: campos.tipo_usuario.value })
            });
            if (r.statusHttp === 429)
                setErroPedir(mensagemDaApi(r, 'Muitas tentativas. Espere alguns minutos.'));
            else {
                setEmailEnviado(email);
                setEtapa('etapa-enviado');
            }
        } catch {
            setErroPedir(ERRO_CONEXAO);
        }
        travaEnvio.current = false;
        setEnviandoLink(false);
    }

    async function aoSalvar(ev) {
        ev.preventDefault();
        if (travaEnvio.current) return;
        setErroNova('');
        if (!REGRAS.every((regra) => regra.ok(senha))) {
            setErroNova('A senha nova ainda não cumpre as regras acima.');
            return;
        }
        if (senha !== inputConfirma.current.value) {
            setErroNova('As duas senhas não são iguais.');
            inputConfirma.current.focus();
            return;
        }
        travaEnvio.current = true;
        setSalvando(true);
        try {
            const r = await chamadaApi('/auth/senha/redefinir', {
                method: 'POST',
                body: JSON.stringify({ token, senha })
            });
            if (r.success) setEtapa('etapa-feito');
            else if (r.statusHttp === 410) setEtapa('etapa-invalido');
            else setErroNova(mensagemDaApi(r, 'Não foi possível salvar a senha.'));
        } catch {
            setErroNova(ERRO_CONEXAO);
        }
        travaEnvio.current = false;
        setSalvando(false);
    }

    return (
        <>
            <main className="split-layout">
                <section className="form-side">
                    <div className="form-container">
                        <img src={logo} alt="Logo MoniPro" className="logo" />

                        {/* Etapa 1: pedir o link (sem token na URL) */}
                        <div id="etapa-pedir" hidden={etapa !== 'etapa-pedir'}>
                            <div className="header-text">
                                <h1 className="text1">Esqueceu a senha?</h1>
                                <p>
                                    Informe o e-mail da sua conta. Enviamos um link para criar uma
                                    senha nova.
                                </p>
                            </div>
                            <form id="formPedir" noValidate onSubmit={aoPedir}>
                                <div className="profile-section">
                                    <p className="profile-title">Qual é a sua conta?</p>
                                    <div className="profile-selector">
                                        <input
                                            type="radio"
                                            id="radioAluno"
                                            name="tipo_usuario"
                                            value="aluno"
                                            defaultChecked
                                        />
                                        <label htmlFor="radioAluno" className="btn-profile">
                                            Aluno
                                        </label>
                                        <input
                                            type="radio"
                                            id="radioMonitor"
                                            name="tipo_usuario"
                                            value="monitor"
                                        />
                                        <label htmlFor="radioMonitor" className="btn-profile">
                                            Monitor
                                        </label>
                                    </div>
                                </div>
                                <div className="input-group">
                                    <div className="icone">
                                        <IconeEmail {...propsIcone} />
                                    </div>
                                    <label htmlFor="inputEmail" className="sr-only">
                                        E-mail
                                    </label>
                                    <input
                                        ref={inputEmail}
                                        type="email"
                                        id="inputEmail"
                                        placeholder="seu.nome@exemplo.edu.br"
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                                <p className="rs-erro" id="erroPedir" role="alert">
                                    {erroPedir}
                                </p>
                                <input
                                    type="submit"
                                    id="enviarLink"
                                    className="rs-botao"
                                    value={enviandoLink ? 'Enviando…' : 'Enviar link'}
                                    disabled={enviandoLink}
                                />
                                <div className="link-cadastro">
                                    <p className="cadastro">Lembrou a senha?</p>
                                    <a href="index.html">Voltar ao login</a>
                                </div>
                            </form>
                        </div>

                        {/* Etapa 1b: resposta genérica (a mesma exista a conta ou não) */}
                        <div
                            id="etapa-enviado"
                            className="rs-caixa"
                            hidden={etapa !== 'etapa-enviado'}
                            tabIndex={-1}
                            ref={caixaEnviado}
                        >
                            <div className="rs-ico">
                                <IconeEmail {...propsIconeCaixa} />
                            </div>
                            <h1 className="text1">Confira seu e-mail</h1>
                            <p>
                                Se existir uma conta com <strong id="emailEnviado">{emailEnviado}</strong>
                                , você vai receber um link em alguns minutos. O link vale por 30
                                minutos e só funciona uma vez.
                            </p>
                            <p className="rs-dica">
                                Não chegou? Veja a caixa de spam ou peça de novo daqui a 1 minuto.
                            </p>
                            <button
                                type="button"
                                className="rs-sec"
                                id="pedirDeNovo"
                                onClick={() => setEtapa('etapa-pedir')}
                            >
                                Usar outro e-mail
                            </button>
                            <div className="link-cadastro">
                                <a href="index.html">Voltar ao login</a>
                            </div>
                        </div>

                        {/* Etapa 2: criar a senha nova (com ?token=...) */}
                        <div id="etapa-nova" hidden={etapa !== 'etapa-nova'}>
                            <div className="header-text">
                                <h1 className="text1">Crie uma senha nova</h1>
                                <p>
                                    Depois de salvar, você entra de novo com a senha nova. As
                                    outras sessões abertas são encerradas.
                                </p>
                            </div>
                            <form id="formNova" noValidate onSubmit={aoSalvar}>
                                <div className="input-group input-group-senha">
                                    <IconeCadeado />
                                    <label htmlFor="inputNova" className="sr-only">
                                        Senha nova
                                    </label>
                                    <input
                                        type={senhaVisivel ? 'text' : 'password'}
                                        id="inputNova"
                                        placeholder="Senha nova"
                                        autoComplete="new-password"
                                        aria-describedby="regras"
                                        value={senha}
                                        onChange={(ev) => setSenha(ev.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="olho"
                                        aria-label={senhaVisivel ? 'Esconder senha' : 'Mostrar senha'}
                                        data-target="inputNova"
                                        onClick={() => setSenhaVisivel((atual) => !atual)}
                                    >
                                        <svg {...propsIcone}>
                                            {senhaVisivel ? (
                                                <>
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                </>
                                            ) : (
                                                <>
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </>
                                            )}
                                        </svg>
                                    </button>
                                </div>
                                <ul className="rs-regras" id="regras" aria-live="polite">
                                    {REGRAS.map((regra) => (
                                        <li
                                            key={regra.id}
                                            data-regra={regra.id}
                                            className={regra.ok(senha) ? 'ok' : undefined}
                                        >
                                            {regra.texto}
                                        </li>
                                    ))}
                                </ul>
                                <div className="input-group input-group-senha">
                                    <IconeCadeado />
                                    <label htmlFor="inputConfirma" className="sr-only">
                                        Repita a senha nova
                                    </label>
                                    <input
                                        ref={inputConfirma}
                                        type="password"
                                        id="inputConfirma"
                                        placeholder="Repita a senha nova"
                                        autoComplete="new-password"
                                    />
                                </div>
                                <p className="rs-erro" id="erroNova" role="alert">
                                    {erroNova}
                                </p>
                                <input
                                    type="submit"
                                    id="salvarNova"
                                    className="rs-botao"
                                    value={salvando ? 'Salvando…' : 'Salvar senha nova'}
                                    disabled={salvando}
                                />
                            </form>
                        </div>

                        {/* Etapa 2b: senha trocada */}
                        <div
                            id="etapa-feito"
                            className="rs-caixa"
                            hidden={etapa !== 'etapa-feito'}
                            tabIndex={-1}
                            ref={caixaFeito}
                        >
                            <div className="rs-ico ok">
                                <svg {...propsIconeCaixa} strokeWidth={2.6}>
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <h1 className="text1">Senha alterada</h1>
                            <p>
                                Entre com a senha nova. Se não foi você quem pediu a troca, avise a
                                coordenação.
                            </p>
                            <a className="rs-pri" href="index.html">
                                Ir para o login
                            </a>
                        </div>

                        {/* Link vencido, já usado ou adulterado */}
                        <div
                            id="etapa-invalido"
                            className="rs-caixa"
                            hidden={etapa !== 'etapa-invalido'}
                            tabIndex={-1}
                            ref={caixaInvalido}
                        >
                            <div className="rs-ico perigo">
                                <svg {...propsIconeCaixa}>
                                    <circle cx="12" cy="12" r="9" />
                                    <polyline points="12 7 12 12 15 14" />
                                </svg>
                            </div>
                            <h1 className="text1">Este link não vale mais</h1>
                            <p>
                                O link de redefinição dura 30 minutos e só pode ser usado uma vez.
                                Peça um novo para continuar.
                            </p>
                            <a className="rs-pri" href="redefinir_senha.html">
                                Pedir novo link
                            </a>
                        </div>

                        <p className="rodape-legal">
                            <a href="privacidade.html">Aviso de Privacidade</a>
                        </p>
                    </div>
                </section>
                <section className="visual-side">
                    <div className="visual-content">
                        <h2>Sua jornada acadêmica, mais organizada.</h2>
                    </div>
                </section>
            </main>
            {/* Vazio como no original: esta tela não usa toast */}
            <div id="toast-container"></div>
        </>
    );
}
