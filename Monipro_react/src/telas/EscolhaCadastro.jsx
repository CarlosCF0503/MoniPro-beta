// Tela de escolha de perfil: porte de Monipro_web/escolha_cadastro.html (a original não tem script).
// Mesmos arquivos e mesma ordem dos <link> do escolha_cadastro.html original
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import '../../../Monipro_web/CSS/escolha_cadastro.css';
import logo from '../../../Monipro_web/IMG/MoniPro-Logo.png';

const propsIcone = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 64,
    height: 64,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
};

// Linhas de texto dentro das páginas do livro (ícone do monitor)
const propsLinha = { strokeWidth: 1.1, strokeOpacity: 0.6 };

export default function EscolhaCadastro() {
    return (
        <main className="split-layout">
            <section className="form-side">
                <div className="form-container text-center">
                    <img src={logo} alt="Logo da MoniPro" className="logo" />

                    <div className="header-text">
                        <h1 className="text1">Qual é o seu perfil?</h1>
                        <p>Selecione como você deseja utilizar o sistema.</p>
                    </div>

                    <div className="opcoes">
                        <a href="cadastro.html?tipo=aluno" className="opcao">
                            <svg {...propsIcone}>
                                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                <path d="M6 12v5c3 3 9 3 12 0v-5" />
                            </svg>
                            <span>Aluno</span>
                        </a>
                        <a href="cadastro.html?tipo=monitor" className="opcao">
                            <svg {...propsIcone}>
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                <line x1="4" y1="9" x2="9" y2="9" {...propsLinha} />
                                <line x1="4" y1="12" x2="9" y2="12" {...propsLinha} />
                                <line x1="4" y1="15" x2="7" y2="15" {...propsLinha} />
                                <line x1="15" y1="9" x2="20" y2="9" {...propsLinha} />
                                <line x1="15" y1="12" x2="20" y2="12" {...propsLinha} />
                                <line x1="15" y1="15" x2="18" y2="15" {...propsLinha} />
                            </svg>
                            <span>Monitor</span>
                        </a>
                    </div>

                    <div className="link-voltar">
                        <a href="index.html">← Voltar para o Login</a>
                    </div>
                    <p className="rodape-legal">
                        <a href="privacidade.html">Aviso de Privacidade</a>
                    </p>
                </div>
            </section>

            <section className="visual-side">
                <div className="visual-content">
                    <h2>Comece sua jornada acadêmica com a gente.</h2>
                </div>
            </section>
        </main>
    );
}
