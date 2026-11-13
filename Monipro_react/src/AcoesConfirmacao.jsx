// Porte de Monipro_web/JS/confirmacao_email.js (plano 14, RF-018): ações comuns às telas que
// esperam a confirmação do e-mail (a etapa "Confira seu e-mail" do cadastro e o aviso do login):
// pedir outro link e corrigir o e-mail digitado errado. O estilo vem de CSS/redefinir_senha.css.
// Quem usa renderiza o contêiner <div id="acoesConfirmacao" className="cf-acoes"> e, dentro dele,
// <AcoesConfirmacao key={...} conta={...} />; trocar a key equivale a montar de novo no original.
import { useEffect, useRef, useState } from 'react';
import { chamadaApi, mensagemDaApi } from './api.js';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERRO_CONEXAO = 'Não foi possível conectar ao servidor. Tente de novo.';

/**
 * Botão "Reenviar link" e o "Digitei o e-mail errado". Só botões (type="button"), porque no
 * login o painel fica dentro do formulário.
 * @param {{ conta: { identificador: string, senha: string, tipo_usuario: string },
 *   aoCorrigir?: (email: string) => void }} props - identificador = e-mail ou matrícula
 */
export default function AcoesConfirmacao({ conta, aoCorrigir }) {
    // Como no original, o identificador passa a ser o e-mail corrigido quando era um e-mail
    const identificador = useRef(conta.identificador);
    const [status, setStatus] = useState({ texto: '', tipo: undefined });
    const [reenviando, setReenviando] = useState(false);
    const [aberto, setAberto] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const inputEmail = useRef(null);
    const avisar = (texto, tipo = 'ok') => setStatus({ texto, tipo });

    useEffect(() => {
        if (aberto) inputEmail.current.focus();
    }, [aberto]);

    // O original desativa o botão na hora (btn.disabled = true); o estado do React só
    // desativa no próximo desenho, então a trava síncrona fica num ref
    const travaReenviar = useRef(false);
    const travaCorrigir = useRef(false);

    async function reenviar() {
        if (travaReenviar.current) return;
        travaReenviar.current = true;
        setReenviando(true);
        try {
            const r = await chamadaApi('/auth/email/reenviar', {
                method: 'POST',
                body: JSON.stringify({
                    identificador: identificador.current,
                    tipo_usuario: conta.tipo_usuario
                })
            });
            if (r.success)
                avisar(
                    'Pronto. Se a conta ainda espera confirmação, o link novo chega em alguns minutos.'
                );
            else avisar(mensagemDaApi(r, 'Não foi possível pedir outro link.'), 'erro');
        } catch {
            avisar(ERRO_CONEXAO, 'erro');
        }
        travaReenviar.current = false;
        setReenviando(false);
    }

    // Só o clique no botão é travado: o Enter no campo chama corrigir() direto, sem trava,
    // como no original (confirmacao_email.js), que não checa o botão desativado
    async function corrigirPeloBotao() {
        if (travaCorrigir.current) return;
        travaCorrigir.current = true;
        try {
            await corrigir();
        } finally {
            travaCorrigir.current = false;
        }
    }

    async function corrigir() {
        const emailNovo = inputEmail.current.value.trim();
        if (!EMAIL_VALIDO.test(emailNovo)) {
            avisar('Digite um e-mail válido, como nome@exemplo.edu.br.', 'erro');
            inputEmail.current.focus();
            return;
        }
        setSalvando(true);
        try {
            const r = await chamadaApi('/auth/email/corrigir', {
                method: 'POST',
                body: JSON.stringify({
                    identificador: identificador.current,
                    senha: conta.senha,
                    tipo_usuario: conta.tipo_usuario,
                    email_novo: emailNovo
                })
            });
            if (r.success) {
                if (identificador.current.includes('@')) identificador.current = r.email;
                setAberto(false);
                avisar(`E-mail corrigido. Enviamos o link para ${r.email}.`);
                if (aoCorrigir) aoCorrigir(r.email);
            } else {
                avisar(mensagemDaApi(r, 'Não foi possível corrigir o e-mail.'), 'erro');
            }
        } catch {
            avisar(ERRO_CONEXAO, 'erro');
        }
        setSalvando(false);
    }

    return (
        <>
            <p className="cf-status" role="status" aria-live="polite" data-tipo={status.tipo}>
                {status.texto}
            </p>
            <button
                type="button"
                className="rs-pri cf-reenviar"
                disabled={reenviando}
                onClick={reenviar}
            >
                {reenviando ? 'Enviando…' : 'Reenviar link'}
            </button>
            <button
                type="button"
                className="cf-link cf-abrir"
                aria-expanded={aberto}
                onClick={() => setAberto((atual) => !atual)}
            >
                Digitei o e-mail errado
            </button>
            <div className="cf-corrigir" hidden={!aberto}>
                <label htmlFor="cfEmailNovo" className="cf-rotulo">
                    E-mail certo
                </label>
                <div className="input-group">
                    <div className="icone">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                    </div>
                    <input
                        ref={inputEmail}
                        type="email"
                        id="cfEmailNovo"
                        placeholder="seu.nome@exemplo.edu.br"
                        autoComplete="email"
                        onKeyDown={(ev) => {
                            // Enter no campo corrige o e-mail, em vez de enviar o formulário de
                            // login em volta
                            if (ev.key === 'Enter') {
                                ev.preventDefault();
                                corrigir();
                            }
                        }}
                    />
                </div>
                <button
                    type="button"
                    className="rs-sec cf-salvar"
                    disabled={salvando}
                    onClick={corrigirPeloBotao}
                >
                    Enviar link para este e-mail
                </button>
            </div>
        </>
    );
}
