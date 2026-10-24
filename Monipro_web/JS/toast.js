/**
 * ******************* MONIPRO WEB *******************
 * Função Global para Exibir Toast Notifications
 * **************************************************
 * * Exibe uma notificação flutuante na interface e registra a mesma mensagem no console.
 * @param {string} mensagem - A mensagem a ser exibida.
 * @param {string} [tipo='default'] - O tipo da notificação ('success', 'error', ou 'default').
 * @param {*} [detalhe] - Opcional: resposta da API ou erro capturado, só para o console.
 */
let timerToast = null;

function showToast(mensagem, tipoInformado, detalhe) {
    const tipo = tipoInformado || 'default';
    registrarNoConsole(mensagem, tipo, detalhe);

    const contentorToast = document.getElementById('toast-container');

    // Verifica se o container está presente na página
    if (!contentorToast) {
        console.warn('showToast(): Container #toast-container não encontrado no DOM.');
        return;
    }

    // Erro é anunciado na hora pelo leitor de tela; sucesso espera a fala atual terminar.
    // O role vem antes do texto para a troca de conteúdo ser anunciada.
    contentorToast.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

    // Configura o texto e limpa classes antigas (para resetar a cor/estilo)
    contentorToast.textContent = mensagem;
    contentorToast.className = '';

    // Aplica o tipo e torna visível
    contentorToast.classList.add('show', tipo);

    // Reinicia o timer: sem isso, o timer de um toast anterior esconde o novo antes dos 3s
    clearTimeout(timerToast);
    timerToast = setTimeout(() => {
        contentorToast.classList.remove('show');
    }, 3000);
}

// Mesma mensagem do toast, no nível de console correspondente ao tipo
function registrarNoConsole(mensagem, tipo, detalhe) {
    const prefixo = '[MoniPro]';
    const extra = detalhe === undefined ? [] : [detalhe];
    if (tipo === 'error') console.error(prefixo, mensagem, ...extra);
    else if (tipo === 'success') console.info(prefixo, mensagem, ...extra);
    else console.log(prefixo, mensagem, ...extra);
}

/**
 * Extrai a mensagem a exibir de uma resposta de chamadaApi().
 * O backend responde erros como { success: false, erro, campos? } (tratadorDeErros.js)
 * e sucessos com { success: true, mensagem? }.
 * @param {object} dados - Objeto retornado por chamadaApi().
 * @param {string} padrao - Texto usado quando o servidor não manda mensagem.
 * @returns {string}
 */
function mensagemDaApi(dados, padrao) {
    if (!dados) return padrao;
    // erro: true (sem texto) é o marcador de resposta não-JSON criado em api.js
    if (typeof dados.erro === 'string' && dados.erro) return dados.erro;
    return dados.mensagem || dados.message || padrao;
}
