// Confirmar e-mail: porte de Monipro_web/confirmar_email.html + JS/confirmar_email.js (plano 14,
// RF-018). O link do e-mail abre esta página com ?token=. A confirmação sai por
// POST /auth/email/confirmar (um GET de verificador de links não confirma sozinho).
import { useEffect, useRef, useState } from 'react';
// Mesmos arquivos e mesma ordem dos <link> do confirmar_email.html original
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import '../../../Monipro_web/CSS/login.css';
import '../../../Monipro_web/CSS/redefinir_senha.css';
import logo from '../../../Monipro_web/IMG/MoniPro-Logo.png';
import { chamadaApi, mensagemDaApi } from '../api.js';

const propsIcone = {
    width: 30,
    height: 30,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
};

// Etapa a mostrar depois do pedido e, em erro do servidor, a mensagem dele. Em falha de rede não
// há mensagem: como no original, continua a que estava na tela.
async function pedirConfirmacao(token) {
    try {
        const r = await chamadaApi('/auth/email/confirmar', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
        if (r.success) return { etapa: 'etapa-confirmado' };
        // 410: vencido, usado ou trocado; 400: token ausente ou cortado no meio
        if (r.statusHttp === 410 || r.statusHttp === 400) return { etapa: 'etapa-invalido' };
        return {
            etapa: 'etapa-erro',
            mensagem: mensagemDaApi(
                r,
                'Algo deu errado do nosso lado. Seu link continua valendo: tente de novo em instantes.'
            )
        };
    } catch {
        return { etapa: 'etapa-erro' };
    }
}

export default function ConfirmarEmail() {
    // O token só vive na memória da tela: não vai para console nem para o armazenamento
    const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
    const [etapa, setEtapa] = useState(token ? 'etapa-confirmando' : 'etapa-invalido');
    const [mensagemErro, setMensagemErro] = useState(
        'Não conseguimos falar com o servidor. Seu link continua valendo: tente de novo em instantes.'
    );
    // Um pedido por vez. Também impede o segundo envio do StrictMode, que gastaria o link
    // (uso único) e mostraria "Este link não vale mais"
    const emAndamento = useRef(false);
    const caixaConfirmando = useRef(null);
    const caixaConfirmado = useRef(null);
    const caixaInvalido = useRef(null);
    const caixaErro = useRef(null);

    // Todas as etapas têm tabindex="-1": cada uma recebe o foco quando aparece
    useEffect(() => {
        const caixa = {
            'etapa-confirmando': caixaConfirmando,
            'etapa-confirmado': caixaConfirmado,
            'etapa-invalido': caixaInvalido,
            'etapa-erro': caixaErro
        }[etapa];
        caixa.current.focus();
    }, [etapa]);

    // Tira o token da barra de endereço (e do histórico) assim que ele é lido e confirma.
    // Se o navegador recusar trocar o endereço, a tela segue normalmente.
    useEffect(() => {
        if (!token) return;
        try {
            window.history.replaceState(null, '', window.location.pathname);
        } catch {
            // sem efeito: o token só continua visível na barra
        }
        if (emAndamento.current) return;
        emAndamento.current = true;
        pedirConfirmacao(token).then((resultado) => {
            emAndamento.current = false;
            if (resultado.mensagem) setMensagemErro(resultado.mensagem);
            setEtapa(resultado.etapa);
        });
    }, [token]);

    async function tentarDeNovo() {
        if (emAndamento.current) return;
        emAndamento.current = true;
        setEtapa('etapa-confirmando');
        const resultado = await pedirConfirmacao(token);
        emAndamento.current = false;
        if (resultado.mensagem) setMensagemErro(resultado.mensagem);
        setEtapa(resultado.etapa);
    }

    return (
        <>
            <main className="split-layout">
                <section className="form-side">
                    <div className="form-container">
                        <img src={logo} alt="Logo MoniPro" className="logo" />

                        {/* Plano 14 (RF-018): o link do e-mail abre esta página com ?token=... */}
                        <div
                            id="etapa-confirmando"
                            className="rs-caixa"
                            hidden={etapa !== 'etapa-confirmando'}
                            tabIndex={-1}
                            ref={caixaConfirmando}
                        >
                            <div className="cf-carregando" aria-hidden="true"></div>
                            <h1 className="text1">Confirmando seu e-mail…</h1>
                            <p>Só um instante.</p>
                        </div>

                        <div
                            id="etapa-confirmado"
                            className="rs-caixa"
                            hidden={etapa !== 'etapa-confirmado'}
                            tabIndex={-1}
                            ref={caixaConfirmado}
                        >
                            <div className="rs-ico ok">
                                <svg {...propsIcone} strokeWidth={2.6}>
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <h1 className="text1">E-mail confirmado</h1>
                            <p>
                                Sua conta está liberada. Entre com o e-mail ou a matrícula e a senha
                                que você criou.
                            </p>
                            <a className="rs-pri" href="index.html">
                                Entrar
                            </a>
                        </div>

                        {/* Link vencido, já usado, trocado por um mais novo ou adulterado */}
                        <div
                            id="etapa-invalido"
                            className="rs-caixa"
                            hidden={etapa !== 'etapa-invalido'}
                            tabIndex={-1}
                            ref={caixaInvalido}
                        >
                            <div className="rs-ico perigo">
                                <svg {...propsIcone}>
                                    <circle cx="12" cy="12" r="9" />
                                    <polyline points="12 7 12 12 15 14" />
                                </svg>
                            </div>
                            <h1 className="text1">Este link não vale mais</h1>
                            <p>
                                O link de confirmação dura 48 horas e só funciona uma vez. Se você
                                já confirmou, é só entrar. Se não, tente entrar: a tela de login
                                oferece um link novo.
                            </p>
                            <a className="rs-pri" href="index.html">
                                Ir para o login
                            </a>
                        </div>

                        {/* Falha de rede ou do servidor: o link pode continuar valendo */}
                        <div
                            id="etapa-erro"
                            className="rs-caixa"
                            hidden={etapa !== 'etapa-erro'}
                            tabIndex={-1}
                            ref={caixaErro}
                        >
                            <div className="rs-ico perigo">
                                <svg {...propsIcone}>
                                    <path d="M12 9v4" />
                                    <path d="M12 17h.01" />
                                    <circle cx="12" cy="12" r="9" />
                                </svg>
                            </div>
                            <h1 className="text1">Não foi possível confirmar agora</h1>
                            <p id="mensagemErro">{mensagemErro}</p>
                            <button
                                type="button"
                                className="rs-pri"
                                id="tentarDeNovo"
                                onClick={tentarDeNovo}
                            >
                                Tentar de novo
                            </button>
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
