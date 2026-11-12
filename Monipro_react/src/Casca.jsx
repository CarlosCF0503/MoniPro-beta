// Casca das telas internas: cabeçalho, menu lateral, aviso de sair e toast, que se repetem em
// Monipro_web/*.html, com a lógica de Monipro_web/JS/base.js (abrir/fechar menu, ir para o
// perfil conforme o papel, sair).
//
// Como usar em src/telas/<Tela>.jsx (a ordem dos imports repete a dos <link> do .html original):
//
//   import '../../../Monipro_web/CSS/fontes.css';
//   import '../../../Monipro_web/CSS/legal.css'; // só se o original importa (vem antes do base.css)
//   import Casca, { useCasca } from '../Casca.jsx'; // já traz fontes.css e base.css
//   import '../../../Monipro_web/CSS/<tela>.css';
//
//   export default function Tela() {
//       return (
//           <Casca>
//               <Conteudo />
//           </Casca>
//       );
//   }
//
// - Vale para base, escolha_disciplina, cadastro_disciplina, marcar_monitoria, perfil_aluno e
//   perfil_monitor: nos seis originais o cabeçalho, o menu e o aviso de sair são os mesmos (nos
//   dois perfis só muda a ordem das classes: "perfil-link header-icon"). perfil.html é exceção:
//   casca antiga, ícones em <img> (IMG/Icone_*.png) sem role/tabindex/aria-label, e nenhuma tela
//   aponta para ela. Com esta casca ela ganharia os ícones SVG: decidir com o time antes.
// - children entra entre o #aviso_sair e o #toast-container, como no original: é onde ficam o
//   <main>, o <footer class="rodape-legal"> (as telas de perfil não têm) e os modais da tela.
// - O que varia por tela fica na tela: <title> no <tela>.html (marcar_monitoria troca o título
//   depois de carregar), CSS extra nos imports, classe no <body> (pp-com-abas dos perfis),
//   para onde ir sem sessão (cada tela original faz do seu jeito). O menu não tem item ativo
//   em nenhuma tela original.
// - Ordem do CSS no build: CSS importado por mais de uma tela e sem JS junto (legal.css) vira
//   arquivo à parte, que o Vite carrega DEPOIS do CSS da tela, e não antes como no original.
//   Em base.html isso não muda nenhum estilo (medido). Conferir em cada tela nova.
// - useCasca() só vale em componente renderizado dentro de <Casca> (o <Conteudo /> acima):
//     showToast(mensagem, tipo, detalhe)  o toast é um só por página e mora na casca; a
//                                         função é estável, pode entrar em deps de efeito
//     abrir('nome')   acende o #overlay e deixa aberto === 'nome'
//     aberto          null, 'menu', 'sair' (reservados da casca) ou o nome que a tela abriu
//     fecharTudo()    o hideAll do base.js: fecha menu, aviso de sair e o modal da tela
//   Modal da tela sobre o #overlay (o #modal-confirmacao de perfil.html):
//     <div id="modal-confirmacao"
//          className={aberto === 'confirmacao' ? 'modal-aviso aparecer' : 'modal-aviso'}>
//   Clique no #overlay, no X do menu ou em "Voltar" do aviso de sair chama fecharTudo(), então
//   o modal da tela fecha junto, como no base.js. O base.js só trata clique: Esc não fecha nada
//   e Enter/Espaço não acionam os role="button" do cabeçalho e do menu; a casca repete isso.
//   <dialog> nativo (perfil_aluno, perfil_monitor) não passa por aqui: tem fundo e Esc próprios.
// - Sessão: a casca só consulta obterSessao() no clique em "Perfil". A tela que precisa do
//   usuário chama obterSessao() de ../api.js (uma consulta por página, compartilhada).
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../Monipro_web/CSS/fontes.css';
import '../../Monipro_web/CSS/base.css';
import logoMenor from '../../Monipro_web/IMG/MoniPro_logo-menor.png';
import logoMenu from '../../Monipro_web/IMG/Logo.png';
import { encerrarSessao, obterSessao } from './api.js';
import { Toast, useToast } from './toast.jsx';

const ContextoCasca = createContext(null);

export function useCasca() {
    return use(ContextoCasca);
}

// P3 (R7): quem está logado vem de GET /auth/sessao (obterSessao, em api.js)
export function paginaDoPerfil(user) {
    return String(user.tipo).toLowerCase() === 'monitor'
        ? 'perfil_monitor.html'
        : 'perfil_aluno.html';
}

const propsIcone = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
};

export default function Casca({ children }) {
    // O que está aberto sobre o #overlay: null, 'menu', 'sair' ou o modal que a tela abriu
    const [aberto, setAberto] = useState(null);
    const [saindo, setSaindo] = useState(false);
    const [toast, mostrarToast] = useToast();

    // useToast devolve uma função nova a cada render; as telas recebem uma estável
    const toastAtual = useRef(mostrarToast);
    useEffect(() => {
        toastAtual.current = mostrarToast;
    });
    const showToast = useCallback((...args) => toastAtual.current(...args), []);

    const fecharTudo = useCallback(() => setAberto(null), []);

    const contexto = useMemo(
        () => ({ aberto, abrir: setAberto, fecharTudo, showToast }),
        [aberto, fecharTudo, showToast]
    );

    // Redireciona para a tela de perfil correta conforme o papel de quem está logado
    async function irParaPerfil() {
        let user;
        try {
            user = await obterSessao();
        } catch (erro) {
            showToast('Não foi possível conectar ao servidor.', 'error', erro);
            return;
        }
        window.location.href = user ? paginaDoPerfil(user) : 'index.html';
    }

    async function confirmarSaida() {
        setSaindo(true);
        // P3 (R7): o servidor revoga o token e apaga o cookie
        await encerrarSessao();
        showToast('Sessão encerrada com sucesso!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }

    return (
        <ContextoCasca value={contexto}>
            <header>
                <div className="logo">
                    <a href="base.html">
                        <img src={logoMenor} alt="Logo MoniPro" />
                    </a>
                </div>

                <div className="header-actions">
                    <div
                        className="header-icon perfil-link"
                        role="button"
                        tabIndex={0}
                        aria-label="Ver perfil do usuário"
                        onClick={irParaPerfil}
                    >
                        <svg {...propsIcone} width="26" height="26" stroke="#071E3D">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        </svg>
                    </div>

                    {/* aria-expanded fica fixo em "false", como no original: o base.js não o atualiza */}
                    <div
                        id="menu"
                        className="header-icon"
                        role="button"
                        tabIndex={0}
                        aria-label="Abrir menu de navegação"
                        aria-expanded="false"
                        aria-controls="menuLateral"
                        onClick={() => setAberto('menu')}
                    >
                        <svg
                            {...propsIcone}
                            width="26"
                            height="26"
                            stroke="#071E3D"
                            strokeWidth={2}
                        >
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </div>
                </div>
            </header>

            <div id="overlay" className={aberto ? 'active' : undefined} onClick={fecharTudo}></div>

            <nav
                id="menuLateral"
                aria-label="Menu principal"
                className={aberto === 'menu' ? 'aparecer' : undefined}
            >
                <div className="logo_fechar">
                    <img src={logoMenu} alt="Logo MoniPro" />
                    <div
                        id="menu_fechar"
                        role="button"
                        tabIndex={0}
                        aria-label="Fechar menu"
                        onClick={fecharTudo}
                    >
                        <svg {...propsIcone} width="24" height="24" strokeWidth={2.5}>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </div>
                </div>

                <div
                    className="item perfil-link"
                    role="button"
                    tabIndex={0}
                    aria-label="Ir para Perfil"
                    onClick={irParaPerfil}
                >
                    <div className="icone">
                        <svg {...propsIcone} width="28" height="28">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        </svg>
                    </div>
                    <p>Perfil</p>
                </div>

                <div
                    className="item monitoria-link"
                    role="button"
                    tabIndex={0}
                    aria-label="Ir para Monitoria"
                    onClick={() => {
                        window.location.href = 'escolha_disciplina.html';
                    }}
                >
                    <div className="icone">
                        <svg {...propsIcone} width="28" height="28">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                    </div>
                    <p>Monitoria</p>
                </div>

                <div
                    id="sair"
                    className="item"
                    role="button"
                    tabIndex={0}
                    aria-label="Sair do sistema"
                    onClick={() => setAberto('sair')}
                >
                    <div className="icone">
                        <svg {...propsIcone} width="28" height="28">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </div>
                    <p>Sair</p>
                </div>
            </nav>

            <div id="aviso_sair" className={aberto === 'sair' ? 'aparecer' : undefined}>
                <div className="icone_sair">
                    <svg {...propsIcone} width="56" height="56" stroke="#F59E0B">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <p>Tem certeza que quer sair?</p>
                </div>
                <div className="areaSim">
                    <button id="btnSim" disabled={saindo} onClick={confirmarSaida}>
                        Sair
                    </button>
                </div>
                <div className="areaNao">
                    <button id="btnNao" onClick={fecharTudo}>
                        Voltar
                    </button>
                </div>
            </div>

            {children}

            <Toast toast={toast} />
        </ContextoCasca>
    );
}
