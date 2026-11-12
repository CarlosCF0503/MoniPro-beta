// Tela de login: porte de Monipro_web/index.html + JS/login.js.
import { useState } from 'react';
// Mesmos arquivos e mesma ordem dos <link> do index.html original
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import '../../../Monipro_web/CSS/login.css';
import logo from '../../../Monipro_web/IMG/MoniPro-Logo.png';
import { chamadaApi, mensagemDaApi } from '../api.js';
import { Toast, useToast } from '../toast.jsx';

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

export default function Login() {
    const [senhaVisivel, setSenhaVisivel] = useState(false);
    const [botao, setBotao] = useState({ rotulo: 'Acessar Sistema', desativado: false });
    const [toast, showToast] = useToast();

    async function aoEnviar(e) {
        e.preventDefault();

        // Lido do formulário na hora do envio, como no original (cobre preenchimento automático)
        const campos = new FormData(e.currentTarget);
        const identificador = campos.get('identificador').trim();
        const senha = campos.get('password');
        const tipoUsuario = campos.get('tipo_usuario');

        if (!identificador || !senha || !tipoUsuario) {
            showToast('Preencha todos os campos.', 'error');
            return;
        }

        setBotao({ rotulo: 'Aguarde...', desativado: true });

        try {
            // chamadaApi (api.js) trata resposta não-JSON e registra falhas no console
            const dados = await chamadaApi('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ identificador, senha, tipo_usuario: tipoUsuario })
            });

            if (dados.success) {
                // P3 (R7): a sessão ficou no cookie httpOnly que a API gravou; nada a guardar aqui
                showToast('Login realizado com sucesso!', 'success');
                // base.html ainda é a página estática de Monipro_web
                setTimeout(() => {
                    window.location.href = 'base.html';
                }, 1000);
            } else {
                showToast(mensagemDaApi(dados, 'Credenciais inválidas.'), 'error', dados);
            }
        } catch (error) {
            showToast('Erro de conexão com o servidor.', 'error', error);
        } finally {
            // Como no login.js original: depois da primeira tentativa o botão passa a "Entrar"
            setBotao({ rotulo: 'Entrar', desativado: false });
        }
    }

    return (
        <>
            <main className="split-layout">
                <section className="form-side">
                    <div className="form-container">
                        <img src={logo} alt="Logo MoniPro" className="logo" />

                        <div className="header-text">
                            <h1 className="text1">Bem-vindo de volta!</h1>
                            <p>Faça login para acessar o seu painel.</p>
                        </div>

                        <form id="formLogin" onSubmit={aoEnviar}>
                            <div className="profile-section">
                                <p className="profile-title">Escolha como deseja entrar:</p>
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
                                    <svg {...propsIcone}>
                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                </div>
                                <label htmlFor="inputIdentificador" className="sr-only">
                                    E-mail ou Matrícula
                                </label>
                                <input
                                    type="text"
                                    id="inputIdentificador"
                                    name="identificador"
                                    placeholder="E-mail ou Matrícula"
                                    required
                                />
                            </div>

                            <div className="input-group input-group-senha">
                                <div className="icone">
                                    <svg {...propsIcone}>
                                        <rect x="3" y="11" width="18" height="11" rx="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>
                                <label htmlFor="inputSenha" className="sr-only">
                                    Senha
                                </label>
                                <input
                                    type={senhaVisivel ? 'text' : 'password'}
                                    id="inputSenha"
                                    name="password"
                                    placeholder="Senha"
                                    required
                                />
                                <button
                                    type="button"
                                    className="olho"
                                    aria-label={senhaVisivel ? 'Esconder senha' : 'Mostrar senha'}
                                    onClick={() => setSenhaVisivel((visivel) => !visivel)}
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

                            {/* Vazio como no original: nenhum script escreve nele, mas ocupa espaço */}
                            <p id="erro"></p>

                            <input
                                type="submit"
                                id="entrar"
                                value={botao.rotulo}
                                disabled={botao.desativado}
                            />

                            <div className="link-cadastro">
                                <p className="cadastro">Não tem cadastro?</p>
                                <a href="escolha_cadastro.html">Cadastre-se</a>
                            </div>

                            <p className="rodape-legal">
                                <a href="privacidade.html">Aviso de Privacidade</a>
                            </p>
                        </form>
                    </div>
                </section>

                <section className="visual-side">
                    <div className="visual-content">
                        <h2>Sua jornada acadêmica, mais organizada.</h2>
                    </div>
                </section>
            </main>

            <Toast toast={toast} />
        </>
    );
}
