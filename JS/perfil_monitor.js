document.addEventListener('DOMContentLoaded', () => {
    const verCertificadosBtn = document.getElementById('abrir_c');
    const perfilCard = document.getElementById('perfil_informacao');
    const certificadosArea = document.getElementById('area_certificados');

    // Garante que os elementos existem antes de adicionar eventos
    if (verCertificadosBtn && perfilCard && certificadosArea) {
        
        verCertificadosBtn.addEventListener('click', () => {
            // Alterna a visibilidade dos certificados e o movimento do card de perfil
            certificadosArea.classList.toggle('aparecer');
            perfilCard.classList.toggle('mudar');

            // Alterna o texto do botão
            if (certificadosArea.classList.contains('aparecer')) {
                verCertificadosBtn.textContent = "Voltar";
            } else {
                verCertificadosBtn.textContent = "Ver";
            }
        });

    }
});