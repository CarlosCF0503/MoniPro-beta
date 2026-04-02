// JS/base.js

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELEÇÃO DOS ELEMENTOS GERAIS ---
    const menuIcon = document.getElementById('menu');
    const closeMenuIcon = document.getElementById('menu_fechar');
    const sidebar = document.getElementById('menuLateral');

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
    };

    // --- 3. FUNÇÕES DE AUTENTICAÇÃO E PERFIL ---
    // Descodifica o Token JWT para ler os dados do utilizador
    const parseJwt = (token) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    };

    // Redireciona sempre para o novo ecrã inteligente de Perfil
    const handleProfileRedirect = () => {
        const token = localStorage.getItem('monipro_token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        window.location.href = 'perfil.html';
    };

    // --- 4. EVENT LISTENERS (CLIQUES) ---
    if (menuIcon) menuIcon.addEventListener('click', () => showElement(sidebar));
    if (closeMenuIcon) closeMenuIcon.addEventListener('click', hideAll);
    if (overlay) overlay.addEventListener('click', hideAll);
    if (cancelLogoutButton) cancelLogoutButton.addEventListener('click', hideAll);

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('aparecer');
            showElement(logoutModal);
        });
    }

    // Ações dos links do menu lateral
    profileLinks.forEach(link => {
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
        confirmLogoutButton.addEventListener('click', () => {
            localStorage.removeItem('monipro_token');
            if (typeof showToast === 'function') {
                showToast('Sessão encerrada com sucesso!', 'success');
            }
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        });
    }

    // --- 5. LÓGICA EXCLUSIVA DO DASHBOARD (base.html) ---
    const dashNomeUsuario = document.getElementById('dash-nome-usuario');
    const dashLinkPerfil = document.getElementById('dash-link-perfil');

    if (dashNomeUsuario && dashLinkPerfil) {
        const token = localStorage.getItem('monipro_token');
        if (token) {
            const user = parseJwt(token);
            if (user) {
                // Removemos a variável redundante e garantimos que o split opera numa string válida
                dashNomeUsuario.textContent = (user.nome_completo)
                    ? String(user.nome_completo).split(' ')[0]
                    : String(user.email).split('@')[0];
            }
            dashLinkPerfil.href = 'perfil.html';
        } else {
            window.location.href = 'index.html';
        }
    }
});