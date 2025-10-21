document.addEventListener('DOMContentLoaded', () => {
    // --- Seleção dos Elementos ---
    const menuIcon = document.getElementById('menu');
    const closeMenuIcon = document.getElementById('menu_fechar');
    const sidebar = document.getElementById('menuLateral');
    
    const logoutButton = document.getElementById('sair');
    const logoutModal = document.getElementById('aviso_sair');
    const confirmLogoutButton = document.getElementById('btnSim');
    const cancelLogoutButton = document.getElementById('btnNao');

    // Adicionado: Overlay para o fundo escuro
    const overlay = document.getElementById('overlay');

    // --- Funções para controlar a visibilidade ---
    const showElement = (element) => {
        overlay.classList.add('active');
        element.classList.add('aparecer');
    };

    const hideAll = () => {
        overlay.classList.remove('active');
        sidebar.classList.remove('aparecer');
        logoutModal.classList.remove('aparecer');
    };

    // --- Event Listeners ---

    // Abrir o menu lateral
    menuIcon.addEventListener('click', () => {
        showElement(sidebar);
    });

    // Fechar o menu lateral pelo ícone 'X'
    closeMenuIcon.addEventListener('click', hideAll);

    // Abrir o modal de confirmação de logout
    logoutButton.addEventListener('click', () => {
        // Primeiro, esconde o menu lateral para depois mostrar o modal
        sidebar.classList.remove('aparecer');
        showElement(logoutModal);
    });

    // Cancelar o logout
    cancelLogoutButton.addEventListener('click', hideAll);

    // Fechar tudo ao clicar no fundo escuro (overlay)
    overlay.addEventListener('click', hideAll);

    // --- LÓGICA CRÍTICA DE LOGOUT ---
    confirmLogoutButton.addEventListener('click', () => {
        // 1. Remove o token de autenticação do armazenamento local
        localStorage.removeItem('monipro_token');
        
        // 2. Redireciona para a página de login
        window.location.href = 'index.html';
    });
});