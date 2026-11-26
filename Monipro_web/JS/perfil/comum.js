// JS/perfil/comum.js
// Peças iguais nos perfis do aluno (JS/perfil/aluno.js) e do monitor (JS/perfil/monitor.js):
// a conferência da sessão ao abrir a página e os ícones (traço arredondado, currentColor, como no
// header).

import { showToast } from '../toast.js';
import { obterSessao } from '../api.js';

/**
 * P3 (R7): quem está logado vem de GET /auth/sessao (o token fica no cookie httpOnly). Sem
 * sessão, avisa e volta ao login; com a conta do outro tipo, vai para o perfil certo.
 * @param {boolean} paginaDoMonitor true em perfil_monitor.html, false em perfil_aluno.html
 * @returns {Promise<boolean>} true quando a página pode seguir
 */
export async function conferirSessaoDoPerfil(paginaDoMonitor) {
    let usuarioSessao;
    try {
        usuarioSessao = await obterSessao();
    } catch (erro) {
        showToast(erro.message || 'Falha na comunicação com o servidor.', 'error', erro);
        return false;
    }
    if (!usuarioSessao) {
        showToast('Sessão expirada. Faça login novamente.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return false;
    }
    const ehMonitor = usuarioSessao.tipo === 'monitor';
    if (ehMonitor !== paginaDoMonitor) {
        window.location.href = ehMonitor ? 'perfil_monitor.html' : 'perfil_aluno.html';
        return false;
    }
    return true;
}

const ICONES = {
    // Plano 7: comprovante anexado ao pedido de revisão da falta
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    local: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4V8z"/>',
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
    pessoas:
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendario:
        '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    ok: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    medalha: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
    moeda: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 10h5M9.5 14h5"/>',
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    matricula:
        '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/>',
    direita: '<polyline points="9 18 15 12 9 6"/>',
    esquerda: '<polyline points="15 18 9 12 15 6"/>',
    semRede:
        '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'
};

/**
 * @param {string} nome chave de ICONES
 * @param {number} [tamanho=14] largura e altura em px
 * @returns {string} o SVG do ícone, decorativo (aria-hidden)
 */
export function icone(nome, tamanho) {
    const t = tamanho || 14;
    return (
        '<svg class="ico" width="' +
        t +
        '" height="' +
        t +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        ICONES[nome] +
        '</svg>'
    );
}
