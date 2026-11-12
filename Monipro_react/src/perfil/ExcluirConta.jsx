// R3 (LGPD): "Excluir minha conta" nos perfis do aluno e do monitor (computador e celular).
// Porte de Monipro_web/JS/perfil/excluir_conta.js: o bloco que vai nos dados do usuário e o
// diálogo que pede a senha e chama DELETE /perfil.
//
// Como usar na tela do perfil (dentro de <Casca>, por causa do toast):
//
//   const excluirConta = useRef(null);
//   ...
//   <BlocoPrivacidade aoExcluir={(ev) => excluirConta.current.abrir(ev.currentTarget)} />
//   ...
//   <DialogoExcluirConta ref={excluirConta} painel={celular} />   // junto dos outros <dialog>
//
// No original o diálogo é criado no primeiro clique e pendurado no fim do <body>; aqui ele já
// nasce com a tela (fechado), ao lado dos outros diálogos.
import { useImperativeHandle, useRef, useState } from 'react';
import { chamadaApi, mensagemDaApi } from '../api.js';
import { useCasca } from '../Casca.jsx';

/** Aviso de Privacidade + botão "Excluir minha conta" (o blocoHTML() do original). */
export function BlocoPrivacidade({ aoExcluir }) {
    return (
        <div className="pp-privacidade">
            <a href="privacidade.html">Aviso de Privacidade</a>
            <button
                type="button"
                className="pp-btn pp-btn-texto-perigo"
                data-excluir-conta=""
                onClick={aoExcluir}
            >
                Excluir minha conta
            </button>
        </div>
    );
}

/**
 * ref.current.abrir(botao): abre o diálogo; ao fechar, o foco volta para o botão que abriu.
 * painel: no celular os diálogos do perfil sobem do rodapé (.pp-painel).
 */
export function DialogoExcluirConta({ ref, painel }) {
    const { showToast } = useCasca();
    const dlg = useRef(null);
    const senha = useRef(null);
    const gatilho = useRef(null);
    // null até o primeiro erro ou fechamento: o original só põe aria-invalid a partir daí
    const [erro, setErro] = useState(null);
    const [excluindo, setExcluindo] = useState(false);
    // Trava síncrona contra envio duplo (o original desativa o botão na hora)
    const enviando = useRef(false);

    useImperativeHandle(
        ref,
        () => ({
            abrir(botao) {
                gatilho.current = botao;
                dlg.current.showModal();
                senha.current.focus();
            }
        }),
        []
    );

    function mostrarErro(texto) {
        setErro(texto);
        if (texto) senha.current.focus();
    }

    function aoFechar() {
        senha.current.form.reset();
        mostrarErro('');
        if (gatilho.current && document.body.contains(gatilho.current)) gatilho.current.focus();
    }

    async function aoEnviar(ev) {
        ev.preventDefault();
        const valor = senha.current.value;
        if (!valor) return mostrarErro('Digite a sua senha.');
        if (enviando.current) return;
        enviando.current = true;
        setExcluindo(true);
        try {
            const r = await chamadaApi('/perfil', {
                method: 'DELETE',
                body: JSON.stringify({ senha: valor })
            });
            if (r.success) {
                dlg.current.close();
                showToast('Sua conta foi excluída.', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
                return;
            }
            mostrarErro(
                r.statusHttp === 401
                    ? 'Sua sessão terminou. Entre de novo para excluir a conta.'
                    : mensagemDaApi(r, 'Não foi possível excluir a conta.')
            );
        } catch (e) {
            mostrarErro('Erro de rede. Verifique a conexão e tente de novo.');
            console.error('[MoniPro]', e);
        } finally {
            enviando.current = false;
            setExcluindo(false);
        }
    }

    return (
        <dialog
            ref={dlg}
            className={painel ? 'pp-dlg pp-painel' : 'pp-dlg'}
            id="dlg-excluir-conta"
            aria-labelledby="exc-titulo"
            onClose={aoFechar}
        >
            <form method="dialog" id="exc-form" noValidate onSubmit={aoEnviar}>
                <div>
                    <h2 id="exc-titulo">Excluir sua conta?</h2>
                    <p className="pp-sub">Esta ação não pode ser desfeita.</p>
                </div>
                <ul className="pp-exc-lista">
                    <li>Seu nome, e-mail, matrícula e senha são apagados.</li>
                    <li>Suas inscrições e vagas futuras são canceladas.</li>
                    <li>O histórico de monitorias passadas fica, sem nada que identifique você.</li>
                </ul>
                <div className="pp-campo">
                    <label className="pp-rotulo" htmlFor="exc-senha">
                        Digite sua senha para confirmar
                    </label>
                    <input
                        ref={senha}
                        type="password"
                        id="exc-senha"
                        name="senha"
                        autoComplete="current-password"
                        required
                        aria-describedby="exc-erro"
                        aria-invalid={erro === null ? undefined : erro ? 'true' : 'false'}
                    />
                    <p className="pp-erro" id="exc-erro" role="alert">
                        {erro}
                    </p>
                </div>
                <div className="pp-acoes">
                    <button
                        type="button"
                        className="pp-btn pp-btn-sec"
                        data-fechar=""
                        onClick={() => dlg.current.close()}
                    >
                        Manter conta
                    </button>
                    <button
                        type="submit"
                        className="pp-btn pp-btn-perigo"
                        id="exc-confirmar"
                        disabled={excluindo}
                    >
                        {excluindo ? 'Excluindo…' : 'Excluir conta'}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
