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
        const finalizarModal = document.getElementById('modal-finalizar');
        if (finalizarModal) {
            finalizarModal.classList.remove('aparecer');
        }
    };

    // --- 3. FUNÇÕES DE AUTENTICAÇÃO E PERFIL ---
    // P3 (R7): quem está logado vem de GET /auth/sessao (obterSessao, em api.js)
    const paginaDoPerfil = (user) =>
        String(user.tipo).toLowerCase() === 'monitor' ? 'perfil_monitor.html' : 'perfil_aluno.html';

    // Redireciona de forma dinâmica para a tela correta baseado no perfil
    const handleProfileRedirect = async () => {
        let user;
        try {
            user = await obterSessao();
        } catch (erro) {
            if (typeof showToast === 'function')
                showToast('Não foi possível conectar ao servidor.', 'error', erro);
            return;
        }
        window.location.href = user ? paginaDoPerfil(user) : 'index.html';
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
                if (typeof showToast === 'function')
                    showToast('Não foi possível conectar ao servidor.', 'error', erro);
            }
        );
    }
});
