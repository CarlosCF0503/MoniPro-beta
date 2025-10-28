/**
 * Exibe uma notificação toast na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} [type='default'] - O tipo de notificação ('success', 'error', ou 'default').
 */
function showToast(message, type = 'default') {
    const toast = document.getElementById('toast-container');
    if (!toast) return; // Não faz nada se o container não existir

    // Define a mensagem e o tipo (cor)
    toast.textContent = message;
    toast.className = ''; // Limpa classes antigas para resetar a cor
    toast.classList.add('show', type);

    // Esconde o toast automaticamente após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}