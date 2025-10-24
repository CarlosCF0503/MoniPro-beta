document.addEventListener('DOMContentLoaded', () => {
    // --- Seleção dos Elementos ---
    const menuIcon = document.getElementById('menu');
    const closeMenuIcon = document.getElementById('menu_fechar');
    const sidebar = document.getElementById('menuLateral');
    
    // Links de perfil (agora usando uma classe)
    const profileLinks = document.querySelectorAll('.perfil-link');
    
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
    };

    // <<<<<<<<<<<<<<< OTIMIZAÇÃO CRÍTICA: Lógica de Perfil >>>>>>>>>>>>>>>
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
            // Se não houver token, envia para a página de login por segurança
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
            // Se o token for inválido, desloga o usuário
            localStorage.removeItem('monipro_token');
            window.location.href = 'index.html';
        }
    };
    // <<<<<<<<<<<<<<< FIM DA OTIMIZAÇÃO DE PERFIL >>>>>>>>>>>>>>>

    // --- Event Listeners ---
    menuIcon.addEventListener('click', () => showElement(sidebar));
    closeMenuIcon.addEventListener('click', hideAll);
    logoutButton.addEventListener('click', () => {
        sidebar.classList.remove('aparecer');
        showElement(logoutModal);
    });
    cancelLogoutButton.addEventListener('click', hideAll);
    overlay.addEventListener('click', hideAll);

    // Adiciona o evento de clique para TODOS os links de perfil
    profileLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Previne a navegação padrão do link
            handleProfileRedirect();
        });
    });

    // Lógica de Logout
    confirmLogoutButton.addEventListener('click', () => {
        localStorage.removeItem('monipro_token');
        window.location.href = 'index.html';
    });
});
