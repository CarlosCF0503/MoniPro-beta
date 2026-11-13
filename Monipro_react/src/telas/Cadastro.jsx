// Tela de cadastro: porte de Monipro_web/cadastro.html + JS/cadastro.js.
import { useEffect, useRef, useState } from 'react';
// Mesmos arquivos e mesma ordem dos <link> do cadastro.html original
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import '../../../Monipro_web/CSS/cadastro.css';
import '../../../Monipro_web/CSS/redefinir_senha.css';
import logo from '../../../Monipro_web/IMG/MoniPro-Logo.png';
import { chamadaApi, mensagemDaApi } from '../api.js';
import { Toast, useToast } from '../toast.jsx';
import AcoesConfirmacao from '../AcoesConfirmacao.jsx';

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

// Os dois campos de senha têm a mesma estrutura; cada um mostra/esconde a própria senha.
// O rótulo oculto e o placeholder têm o mesmo texto nos dois campos do original.
function CampoSenha({ id, rotulo, descritoPor }) {
    const [visivel, setVisivel] = useState(false);

    return (
        <div className="input-group input-group-senha">
            <div className="icone">
                <svg {...propsIcone}>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            </div>
            <label htmlFor={id} className="sr-only">
                {rotulo}
            </label>
            <input
                type={visivel ? 'text' : 'password'}
                id={id}
                placeholder={rotulo}
                aria-describedby={descritoPor}
                required
            />
            <button
                type="button"
                className="olho"
                aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}
                data-target={id}
                onClick={() => setVisivel((atual) => !atual)}
            >
                <svg {...propsIcone}>
                    {visivel ? (
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
    );
}

export default function Cadastro() {
    const [enviando, setEnviando] = useState(false);
    const [toast, showToast] = useToast();
    // Plano 14 (RF-018): etapa "Confira seu e-mail". A matrícula identifica a conta nos pedidos
    // seguintes (continua a mesma se o e-mail for corrigido); a senha fica só na memória da
    // página, para corrigir o e-mail sem pedir de novo.
    const [confira, setConfira] = useState(null);
    const refConfira = useRef(null);
    // Foco só quando a etapa aparece (corrigir o e-mail troca o texto, não o foco)
    const mostrandoConfira = confira !== null;

    useEffect(() => {
        if (mostrandoConfira) refConfira.current.focus();
    }, [mostrandoConfira]);

    async function aoEnviar(e) {
        e.preventDefault();
        const form = e.currentTarget;

        // Lido do formulário na hora do envio, como no original (cobre preenchimento
        // automático). Os campos não têm "name" no original: form.elements acha pelo id.
        const campos = form.elements;
        const nome = campos.inputNome.value.trim();
        const email = campos.inputEmail.value.trim();
        const matricula = campos.inputMatricula.value.trim();
        const senha = campos.inputSenha.value;
        const confirmarSenha = campos.inputConfirmarSenha.value;

        if (!nome || !email || !matricula || !senha) {
            showToast('Preencha todos os campos.', 'error');
            return;
        }
        if (senha !== confirmarSenha) {
            showToast('As senhas não coincidem!', 'error');
            return;
        }

        // Lê o tipo da URL: cadastro.html?tipo=aluno  ou  cadastro.html?tipo=monitor
        const tipo_usuario = new URLSearchParams(window.location.search).get('tipo') || 'aluno';

        setEnviando(true);

        try {
            // chamadaApi (api.js) trata resposta não-JSON e registra falhas no console
            const dados = await chamadaApi('/auth/cadastro', {
                method: 'POST',
                body: JSON.stringify({
                    nome_completo: nome,
                    email,
                    matricula: Number(matricula),
                    senha,
                    tipo_usuario
                })
            });

            if (dados.success) {
                // Plano 14 (RF-018): a conta só entra depois de abrir o link do e-mail
                form.reset();
                setConfira({
                    email,
                    conta: { identificador: String(matricula), senha, tipo_usuario }
                });
            } else {
                showToast(mensagemDaApi(dados, 'Erro ao realizar o cadastro.'), 'error', dados);
            }
        } catch (error) {
            showToast('Sem conexão com o servidor.', 'error', error);
        } finally {
            // Como no cadastro.js original: o botão volta a "Cadastrar" mesmo no sucesso
            setEnviando(false);
        }
    }

    return (
        <>
            <main className="split-layout">
                <section className="form-side">
                    <div className="form-container">
                        <img src={logo} alt="Logo da MoniPro" className="logo" />

                        <form id="formCadastro" onSubmit={aoEnviar} hidden={Boolean(confira)}>
                            <div className="header-text">
                                <h1 className="text1">Criar Conta</h1>
                                <p>Preencha os dados abaixo para se cadastrar.</p>
                            </div>

                            <div className="input-group">
                                <div className="icone">
                                    <svg {...propsIcone}>
                                        <circle cx="12" cy="8" r="4" />
                                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                                    </svg>
                                </div>
                                <label htmlFor="inputNome" className="sr-only">
                                    Nome Completo
                                </label>
                                <input
                                    type="text"
                                    id="inputNome"
                                    placeholder="Nome Completo"
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <div className="icone">
                                    <svg {...propsIcone}>
                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                </div>
                                <label htmlFor="inputEmail" className="sr-only">
                                    Endereço de E-mail
                                </label>
                                <input
                                    type="email"
                                    id="inputEmail"
                                    placeholder="Endereço de E-mail"
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <div className="icone">
                                    <svg {...propsIcone}>
                                        <rect x="2" y="5" width="20" height="14" rx="2" />
                                        <circle cx="9" cy="12" r="2.5" />
                                        <path d="M14 10h4M14 14h4" />
                                    </svg>
                                </div>
                                <label htmlFor="inputMatricula" className="sr-only">
                                    Matrícula
                                </label>
                                <input
                                    type="number"
                                    id="inputMatricula"
                                    placeholder="Número de Matrícula"
                                    required
                                />
                            </div>

                            <CampoSenha id="inputSenha" rotulo="Senha" descritoPor="dicaSenha" />
                            <p id="dicaSenha" className="dica-senha">
                                Mínimo de 8 caracteres, com pelo menos uma letra e um número.
                            </p>

                            <CampoSenha id="inputConfirmarSenha" rotulo="Confirmar Senha" />

                            {/* Vazio como no original: nenhum script escreve nele */}
                            <p id="erro"></p>
                            <p className="aviso-consentimento">
                                {/* Texto e espaço num nó só, como no HTML original
                                    (com {' '} à parte o React cria dois nós de texto) */}
                                {'Ao criar a conta você declara ter lido o '}
                                <a href="privacidade.html">Aviso de Privacidade</a>.
                            </p>
                            <input
                                type="submit"
                                id="entrar"
                                value={enviando ? 'Aguarde...' : 'Cadastrar'}
                                disabled={enviando}
                            />

                            <div className="link-voltar">
                                <p>Já tem uma conta?</p>
                                <a href="index.html">Faça login</a>
                            </div>
                        </form>

                        {/* Plano 14 (RF-018): depois do cadastro, a conta espera a confirmação do e-mail */}
                        <div
                            id="etapa-confira"
                            className="rs-caixa"
                            hidden={!confira}
                            tabIndex={-1}
                            ref={refConfira}
                        >
                            <div className="rs-ico">
                                <svg {...propsIcone} xmlns={undefined} width={30} height={30}>
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                </svg>
                            </div>
                            <h1 className="text1">Confira seu e-mail</h1>
                            <p>
                                {'Enviamos um link de confirmação para '}
                                <strong id="emailCadastrado">{confira?.email}</strong>. Abra o link
                                para liberar o acesso. Ele vale por 48 horas.
                            </p>
                            <p className="rs-dica">Não chegou? Veja a caixa de spam ou peça outro link.</p>
                            <div id="acoesConfirmacao" className="cf-acoes">
                                {confira && (
                                    <AcoesConfirmacao
                                        conta={confira.conta}
                                        aoCorrigir={(novo) =>
                                            setConfira((atual) => ({ ...atual, email: novo }))
                                        }
                                    />
                                )}
                            </div>
                            <a className="rs-sec" href="index.html">
                                Ir para o login
                            </a>
                        </div>
                    </div>
                </section>

                <section className="visual-side">
                    <div className="visual-content">
                        <h2>Gestão de monitorias rápida e simples.</h2>
                    </div>
                </section>
            </main>

            <Toast toast={toast} />
        </>
    );
}
