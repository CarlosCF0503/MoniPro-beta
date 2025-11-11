document.addEventListener('DOMContentLoaded', () => {
    // --- Seleção dos Elementos ---
    const menuIcon = document.getElementById('menu');
    const closeMenuIcon = document.getElementById('menu_fechar');
    const sidebar = document.getElementById('menuLateral');
    
    const profileLinks = document.querySelectorAll('.perfil-link');
    
    // <<<<<<<<<<<<<<< ADICIONADO: Seleciona o link de monitoria
    const monitoriaLink = document.querySelector('.monitoria-link');
    
    const logoutButton = document.getElementById('sair');
    const logoutModal = document.getElementById('aviso_sair');
    const confirmLogoutButton = document.getElementById('btnSim');
    const cancelLogoutButton = document.getElementById('btnNao');
    const overlay = document.getElementById('overlay');

    // --- Funções Auxiliares ---
    const showElement = (element) => {
        overlay.classList.add('active');
        element.classList.add('aparecer');
    };

    const hideAll = () => {
        overlay.classList.remove('active');
        sidebar.classList.remove('aparecer');
        logoutModal.classList.remove('aparecer');

        const confirmModal = document.getElementById('modal-confirmacao');
        if (confirmModal) {
            confirmModal.classList.remove('aparecer');
        }
    };

    // Lógica de Perfil (parseJwt e handleProfileRedirect)
    const parseJwt = (token) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    };

    const handleProfileRedirect = () => {
        const token = localStorage.getItem('monipro_token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        const userData = parseJwt(token);
        if (userData && userData.tipo) {
            if (userData.tipo === 'aluno') {
                window.location.href = 'perfil_aluno.html';
            } else if (userData.tipo === 'monitor') {
                window.location.href = 'perfil_monitor.html';
            }
        } else {
            localStorage.removeItem('monipro_token');
            window.location.href = 'index.html';
        }
    };

    // --- Event Listeners ---
    if(menuIcon) menuIcon.addEventListener('click', () => showElement(sidebar));
    if(closeMenuIcon) closeMenuIcon.addEventListener('click', hideAll);
    if(logoutButton) logoutButton.addEventListener('click', () => {
        sidebar.classList.remove('aparecer');
        showElement(logoutModal);
    });
    if(cancelLogoutButton) cancelLogoutButton.addEventListener('click', hideAll);
    if(overlay) overlay.addEventListener('click', hideAll);

    // Links de Perfil
    profileLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            handleProfileRedirect();
        });
    });

    // <<<<<<<<<<<<<<< ADICIONADO: Evento para o link de Monitoria
    if (monitoriaLink) {
        monitoriaLink.addEventListener('click', (event) => {
            event.preventDefault(); // Previne a navegação padrão do link
            window.location.href = 'escolha_disciplina.html';
        });
    }

    // Lógica de Logout
    if(confirmLogoutButton) confirmLogoutButton.addEventListener('click', () => {
        localStorage.removeItem('monipro_token');
        if (typeof showToast === 'function') {
            showToast('Sessão encerrada com sucesso!', 'success');
        }
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    });
});