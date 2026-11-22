// JS/base.js

import { showToast } from './toast.js';
import { obterSessao, encerrarSessao } from './api.js';

// Item "Ranking" do menu lateral. Fica só aqui (e não em cada HTML) para o menu ser igual em
// todas as telas. É um link de verdade: Enter abre, e aria-current marca a tela atual.
const ICONE_RANKING =
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/>' +
    '<path d="M17 6h2.5a1.5 1.5 0 0 1 0 3H17"/><path d="M7 6H4.5a1.5 1.5 0 0 0 0 3H7"/></svg>';

function incluirItemRanking(sidebar) {
    if (!sidebar || sidebar.querySelector('.ranking-link')) return;
    const item = document.createElement('a');
    item.className = 'item ranking-link';
    item.href = 'ranking.html';
    item.innerHTML = '<div class="icone">' + ICONE_RANKING + '</div><p>Ranking</p>';
    if (/(^|\/)ranking\.html$/.test(window.location.pathname))
        item.setAttribute('aria-current', 'page');
    const sair = sidebar.querySelector('#sair');
    if (sair) sair.before(item);
    else sidebar.append(item);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELEÇÃO DOS ELEMENTOS GERAIS ---
    const menuIcon = document.getElementById('menu');
    const closeMenuIcon = document.getElementById('menu_fechar');
    const sidebar = document.getElementById('menuLateral');
    incluirItemRanking(sidebar);

    const profileLinks = document.querySelectorAll('.perfil-link');
    const monitoriaLink = document.querySelector('.monitoria-link');

    const logoutButton = document.getElementById('sair');
    const logoutModal = document.getElementById('aviso_sair');
    const confirmLogoutButton = document.getElementById('btnSim');
    const cancelLogoutButton = document.getElementById('btnNao');
    const overlay = document.getElementById('overlay');

    // --- 2. FUNÇÕES DE INTERFACE (MENU E MODAIS) ---
    const showElement = (element) => {
        if (overlay) overlay.classList.add('active');
        if (element) element.classList.add('aparecer');
    };

    const hideAll = () => {
        if (overlay) overlay.classList.remove('active');
        if (sidebar) sidebar.classList.remove('aparecer');
        if (logoutModal) logoutModal.classList.remove('aparecer');

        const confirmModal = document.getElementById('modal-confirmacao');
        if (confirmModal) {
            confirmModal.classList.remove('aparecer');
        }
        const finalizarModal = document.getElementById('modal-finalizar');
        if (finalizarModal) {
            finalizarModal.classList.remove('aparecer');
        }
    };

    // --- 3. FUNÇÕES DE AUTENTICAÇÃO E PERFIL ---
    // P3 (R7): quem está logado vem de GET /auth/sessao (obterSessao, em api.js)
    // Plano 7: a coordenação não tem perfil próprio; o ícone de perfil leva ao painel
    const PAGINA_DO_PERFIL = { monitor: 'perfil_monitor.html', coordenador: 'painel.html' };
    const paginaDoPerfil = (user) =>
        PAGINA_DO_PERFIL[String(user.tipo).toLowerCase()] || 'perfil_aluno.html';

    // Redireciona de forma dinâmica para a tela correta baseado no perfil
    const handleProfileRedirect = async () => {
        let user;
        try {
            user = await obterSessao();
        } catch (erro) {
            showToast('Não foi possível conectar ao servidor.', 'error', erro);
            return;
        }
        window.location.href = user ? paginaDoPerfil(user) : 'index.html';
    };

    // --- 4. EVENT LISTENERS (CLIQUES) ---
    const abrirMenu = () => {
        showElement(sidebar);
        if (menuIcon) menuIcon.setAttribute('aria-expanded', 'true');
        // O foco entra no menu para quem navega pelo teclado
        const primeiro = sidebar?.querySelector('.item');
        if (primeiro) primeiro.focus({ preventScroll: true });
    };
    const fecharMenu = () => {
        const estavaAberto = sidebar?.classList.contains('aparecer');
        hideAll();
        if (menuIcon) menuIcon.setAttribute('aria-expanded', 'false');
        if (estavaAberto && menuIcon) menuIcon.focus({ preventScroll: true });
    };
    if (menuIcon) menuIcon.addEventListener('click', abrirMenu);
    if (closeMenuIcon) closeMenuIcon.addEventListener('click', fecharMenu);

    // Os ícones do cabeçalho e os itens do menu são <div role="button">: Enter e Espaço
    // precisam clicar, como num botão de verdade
    document.addEventListener('keydown', (ev) => {
        const alvo = ev.target;
        if (
            (ev.key === 'Enter' || ev.key === ' ') &&
            alvo instanceof HTMLElement &&
            alvo.matches('div[role="button"]') &&
            alvo.closest('header, #menuLateral')
        ) {
            ev.preventDefault();
            alvo.click();
        } else if (ev.key === 'Escape' && sidebar?.classList.contains('aparecer')) {
            fecharMenu();
        }
    });
    if (overlay) overlay.addEventListener('click', fecharMenu);
    if (cancelLogoutButton) cancelLogoutButton.addEventListener('click', hideAll);

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('aparecer');
            if (menuIcon) menuIcon.setAttribute('aria-expanded', 'false');
            showElement(logoutModal);
        });
    }

    // Ações dos links do menu lateral
    profileLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            handleProfileRedirect();
        });
    });

    if (monitoriaLink) {
        monitoriaLink.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = 'escolha_disciplina.html';
        });
    }

    // Ação de confirmar o Logout
    if (confirmLogoutButton) {
        confirmLogoutButton.addEventListener('click', async () => {
            confirmLogoutButton.disabled = true;
            // P3 (R7): o servidor revoga o token e apaga o cookie
            await encerrarSessao();
            showToast('Sessão encerrada com sucesso!', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        });
    }

    // --- 5. LÓGICA EXCLUSIVA DO DASHBOARD (base.html) ---
    const dashNomeUsuario = document.getElementById('dash-nome-usuario');
    const dashLinkPerfil = document.getElementById('dash-link-perfil');

    if (dashNomeUsuario && dashLinkPerfil) {
        obterSessao().then(
            (user) => {
                if (!user) {
                    window.location.href = 'index.html';
                    return;
                }
                dashNomeUsuario.textContent = String(user.nome || 'Usuário').split(' ')[0];
                // Define o link correto dinamicamente para evitar o erro 404
                dashLinkPerfil.href = paginaDoPerfil(user);
            },
            (erro) => {
                showToast('Não foi possível conectar ao servidor.', 'error', erro);
            }
        );
    }
});
