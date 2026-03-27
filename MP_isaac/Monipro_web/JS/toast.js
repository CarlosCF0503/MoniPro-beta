/**
 * ******************* MONIPRO WEB *******************
 * Função Global para Exibir Toast Notifications
 * **************************************************
 * * Exibe uma notificação flutuante na interface.
 * @param {string} mensagem - A mensagem a ser exibida.
 * @param {string} [tipo='default'] - O tipo da notificação ('success', 'error', ou 'default').
 */
function showToast(mensagem, tipo = 'default') {
    const contentorToast = document.getElementById('toast-container');

    // Verifica se o container está presente na página
    if (!contentorToast) {
        console.warn('showToast(): Container #toast-container não encontrado no DOM.');
        return;
    }

    // Configura o texto e limpa classes antigas (para resetar a cor/estilo)
    contentorToast.textContent = mensagem;
    contentorToast.className = '';

    // Aplica o tipo e torna visível
    contentorToast.classList.add('show', tipo);

    // Timeout para desaparecer (evita o uso de um novo timer sobre o antigo no CSS)
    setTimeout(() => {
        contentorToast.classList.remove('show');
    }, 3000);
}