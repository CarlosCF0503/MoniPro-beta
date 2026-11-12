// Porte de Monipro_web/JS/toast.js: o #toast-container vira estado + JSX.
// O estilo continua vindo do CSS de cada tela (#toast-container, .show, .success, .error).
import { useRef, useState } from 'react';

// Mesma mensagem do toast, no nível de console correspondente ao tipo
function registrarNoConsole(mensagem, tipo, detalhe) {
    const prefixo = '[MoniPro]';
    const extra = detalhe === undefined ? [] : [detalhe];
    if (tipo === 'error') console.error(prefixo, mensagem, ...extra);
    else if (tipo === 'success') console.info(prefixo, mensagem, ...extra);
    else console.log(prefixo, mensagem, ...extra);
}

/**
 * Uso: const [toast, showToast] = useToast(); e <Toast toast={toast} /> no fim da tela.
 * showToast(mensagem, tipo, detalhe): tipo é 'success', 'error' ou 'default'; detalhe
 * (resposta da API ou erro capturado) vai só para o console.
 */
export function useToast() {
    const [toast, setToast] = useState({ mensagem: '', tipo: '', visivel: false });
    const timer = useRef(null);

    function showToast(mensagem, tipoInformado, detalhe) {
        const tipo = tipoInformado || 'default';
        registrarNoConsole(mensagem, tipo, detalhe);

        setToast({ mensagem, tipo, visivel: true });

        // Reinicia o timer: sem isso, o timer de um toast anterior esconde o novo antes dos 3s
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            setToast((atual) => ({ ...atual, visivel: false }));
        }, 3000);
    }

    return [toast, showToast];
}

export function Toast({ toast }) {
    // Antes do primeiro aviso o elemento não tem role nem classe, como no HTML original.
    // Erro é anunciado na hora pelo leitor de tela; sucesso espera a fala atual terminar.
    const role = toast.tipo ? (toast.tipo === 'error' ? 'alert' : 'status') : undefined;
    const classes = [toast.visivel ? 'show' : '', toast.tipo].filter(Boolean).join(' ');

    return (
        <div id="toast-container" role={role} className={classes || undefined}>
            {toast.mensagem}
        </div>
    );
}
