// Tela inicial: porte de Monipro_web/base.html + a parte "dashboard" de JS/base.js.
// Cabeçalho, menu lateral, aviso de sair e toast vêm da Casca.
import { useEffect, useState } from 'react';
// Mesmos arquivos e mesma ordem dos <link> do base.html original (o base.css vem da Casca)
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import Casca, { paginaDoPerfil, useCasca } from '../Casca.jsx';
import '../../../Monipro_web/CSS/home.css';
import { obterSessao } from '../api.js';

const propsIcone = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
};

function Inicio() {
    const { showToast } = useCasca();
    // Enquanto a sessão não chega fica como no HTML original: "..." e link do perfil de aluno
    const [usuario, setUsuario] = useState(null);

    useEffect(() => {
        let ativo = true;
        obterSessao().then(
            (user) => {
                if (!ativo) return;
                if (!user) {
                    window.location.href = 'index.html';
                    return;
                }
                setUsuario(user);
            },
            (erro) => {
                if (ativo) showToast('Não foi possível conectar ao servidor.', 'error', erro);
            }
        );
        return () => {
            ativo = false;
        };
    }, [showToast]);

    const primeiroNome = usuario ? String(usuario.nome || 'Usuário').split(' ')[0] : '...';
    // Link certo conforme o papel, para não cair em 404
    const linkPerfil = usuario ? paginaDoPerfil(usuario) : 'perfil_aluno.html';

    return (
        <>
            {/* Como no base.html original: nenhum script desta tela abre este modal */}
            <div id="modal-confirmacao" className="modal-aviso">
                <div className="icone_sair">
                    <svg
                        {...propsIcone}
                        width="56"
                        height="56"
                        stroke="#F59E0B"
                        strokeWidth={1.8}
                    >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <p id="modal-confirmacao-texto">Tem certeza?</p>
                </div>
                <div className="areaSim">
                    <button id="btnConfirmarSim" className="btn-confirmar-acao">
                        Confirmar
                    </button>
                </div>
                <div className="areaNao">
                    <button id="btnConfirmarNao" className="btn-cancelar-acao">
                        Voltar
                    </button>
                </div>
            </div>

            <main className="home-wrapper">
                {/* HERO — Boas-vindas */}
                <div className="home-hero">
                    <div className="hero-text">
                        <p className="hero-label">MoniPro</p>
                        <h1>
                            Olá, <span id="dash-nome-usuario">{primeiroNome}</span>!
                        </h1>
                        <p>Bem-vindo de volta. O que você quer fazer hoje?</p>
                        <a href="escolha_disciplina.html" className="hero-cta">
                            <svg {...propsIcone} width="18" height="18">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                            Ir para Monitoria
                        </a>
                    </div>

                    {/* Ilustração decorativa */}
                    <div className="hero-illustration" aria-hidden="true">
                        <svg
                            width="160"
                            height="140"
                            viewBox="0 0 160 140"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            {/* Livro */}
                            <rect
                                x="20"
                                y="35"
                                width="55"
                                height="72"
                                rx="4"
                                fill="rgba(255,255,255,0.12)"
                                stroke="rgba(255,255,255,0.3)"
                                strokeWidth="2"
                            />
                            <rect
                                x="22"
                                y="37"
                                width="51"
                                height="68"
                                rx="3"
                                fill="rgba(255,255,255,0.06)"
                            />
                            <line
                                x1="47"
                                y1="37"
                                x2="47"
                                y2="105"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="2"
                            />
                            <line
                                x1="28"
                                y1="52"
                                x2="44"
                                y2="52"
                                stroke="rgba(255,255,255,0.35)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="28"
                                y1="60"
                                x2="44"
                                y2="60"
                                stroke="rgba(255,255,255,0.25)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="28"
                                y1="68"
                                x2="40"
                                y2="68"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="50"
                                y1="52"
                                x2="68"
                                y2="52"
                                stroke="rgba(255,255,255,0.35)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="50"
                                y1="60"
                                x2="68"
                                y2="60"
                                stroke="rgba(255,255,255,0.25)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="50"
                                y1="68"
                                x2="62"
                                y2="68"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            {/* Calendário */}
                            <rect
                                x="85"
                                y="20"
                                width="58"
                                height="52"
                                rx="6"
                                fill="rgba(255,255,255,0.14)"
                                stroke="rgba(255,255,255,0.3)"
                                strokeWidth="2"
                            />
                            <rect
                                x="85"
                                y="20"
                                width="58"
                                height="16"
                                rx="6"
                                fill="rgba(255,255,255,0.2)"
                            />
                            <rect
                                x="85"
                                y="30"
                                width="58"
                                height="6"
                                fill="rgba(255,255,255,0.2)"
                            />
                            <circle cx="97" cy="50" r="3.5" fill="rgba(255,255,255,0.5)" />
                            <circle cx="114" cy="50" r="3.5" fill="rgba(172,200,255,0.7)" />
                            <circle cx="131" cy="50" r="3.5" fill="rgba(255,255,255,0.3)" />
                            <circle cx="97" cy="63" r="3.5" fill="rgba(255,255,255,0.3)" />
                            <circle cx="114" cy="63" r="3.5" fill="rgba(255,255,255,0.5)" />
                            {/* Pessoa */}
                            <circle
                                cx="126"
                                cy="95"
                                r="14"
                                fill="rgba(255,255,255,0.12)"
                                stroke="rgba(255,255,255,0.3)"
                                strokeWidth="2"
                            />
                            <circle cx="126" cy="90" r="5" fill="rgba(255,255,255,0.4)" />
                            <path
                                d="M115 106 c0-6 4.5-9.5 11-9.5s11 3.5 11 9.5"
                                stroke="rgba(255,255,255,0.4)"
                                strokeWidth="2"
                                fill="none"
                                strokeLinecap="round"
                            />
                            {/* Estrelas decorativas */}
                            <circle cx="15" cy="20" r="2.5" fill="rgba(172,200,255,0.6)" />
                            <circle cx="150" cy="110" r="2" fill="rgba(255,255,255,0.4)" />
                            <circle cx="78" cy="15" r="1.5" fill="rgba(255,255,255,0.5)" />
                        </svg>
                    </div>
                </div>

                {/* AÇÕES RÁPIDAS */}
                <p className="home-section-title">Acesso Rápido</p>

                <div className="home-cards">
                    {/* Card: Monitoria */}
                    <a href="escolha_disciplina.html" className="home-card">
                        <div className="card-icon-wrap">
                            <svg {...propsIcone} width="26" height="26">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                        </div>
                        <h2>Monitoria</h2>
                        <p>Escolha uma disciplina e agende ou crie sessões de monitoria.</p>
                        <span className="card-arrow">
                            Acessar
                            <svg {...propsIcone} width="16" height="16" strokeWidth={2.5}>
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </span>
                    </a>

                    {/* Card: Perfil */}
                    <a id="dash-link-perfil" href={linkPerfil} className="home-card">
                        <div className="card-icon-wrap">
                            <svg {...propsIcone} width="26" height="26">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                            </svg>
                        </div>
                        <h2>Meu Perfil</h2>
                        <p>
                            Visualize suas informações, histórico de monitorias e certificados.
                        </p>
                        <span className="card-arrow">
                            Acessar
                            <svg {...propsIcone} width="16" height="16" strokeWidth={2.5}>
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </span>
                    </a>
                </div>

                {/* BANNER INFORMATIVO */}
                <div className="home-banner">
                    <div className="banner-icon" aria-hidden="true">
                        {/* No original este ícone não tem aria-hidden próprio (o pai já tem) */}
                        <svg {...propsIcone} aria-hidden={undefined} width="28" height="28">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                        </svg>
                    </div>
                    <div className="banner-text">
                        <h3>Como funciona o MoniPro?</h3>
                        <p>
                            Alunos escolhem uma disciplina, selecionam um monitor disponível e
                            agendam a sessão. Monitores criam vagas e acompanham seus agendamentos
                            pelo painel. Simples assim.
                        </p>
                    </div>
                </div>
            </main>

            <footer className="rodape-legal">
                <a href="privacidade.html">Aviso de Privacidade</a>
            </footer>
        </>
    );
}

export default function Base() {
    return (
        <Casca>
            <Inicio />
        </Casca>
    );
}
