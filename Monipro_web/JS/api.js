// JS/api.js

// URL base do seu servidor. Se for testar localmente, pode alterar para "http://localhost:3000"
const MB_BETA_ORM = "http://localhost:3000";
/**
 * Função centralizada para realizar pedidos ao backend.
 * @param {string} endpoint - O caminho da rota (ex: '/auth/login', '/perfil')
 * @param {object} opcoes - Configurações do fetch (method, body, etc.)
 * @returns {Promise<object>} - A resposta do servidor (garantida como objeto)
 */
async function chamadaApi(endpoint, opcoes = {}) {
    // Tenta recuperar o token guardado no navegador
    const token = localStorage.getItem('monipro_token');

    // Configura os cabeçalhos (headers) padrão
    const cabecalhos = {
        'Content-Type': 'application/json',
        ...opcoes.headers
    };

    // Se o utilizador estiver logado, injeta o token de Autorização automaticamente
    if (token) {
        cabecalhos['Authorization'] = `Bearer ${token}`;
    }

    // Junta as opções originais com os novos cabeçalhos
    const configuracao = { ...opcoes, headers: cabecalhos };

    try {
        // Faz a requisição para a URL Base + Endpoint
        const resposta = await fetch(`${MB_BETA_ORM}${endpoint}`, configuracao);

        // Verifica o tipo de conteúdo retornado pelo servidor
        const contentType = resposta.headers.get("content-type");
        let dados = {};

        // Se a resposta for JSON, faz o parse normalmente
        if (contentType && contentType.includes("application/json")) {
            dados = await resposta.json();
        } else {
            // Se NÃO for JSON (ex: página HTML de erro 404 ou 500), 
            // cria um objeto de erro manual para evitar o crash "Unexpected token '<'"
            dados = { 
                erro: true, 
                mensagem: `Erro inesperado no servidor. A rota pode não existir (${resposta.status}).` 
            };
        }

        // Adicionamos o status HTTP ao objeto para facilitar validações específicas no frontend
        dados.statusHttp = resposta.status;

        // Log de aviso no console caso a requisição não tenha sido sucesso (2xx)
        if (!resposta.ok) {
            console.warn(`Aviso de API: Status ${resposta.status} ao acessar ${endpoint}`);
        }

        return dados;
    } catch (erro) {
        console.error(`Erro de rede no pedido para ${endpoint}:`, erro);
        // Lança um erro padronizado para o bloco 'catch' dos outros scripts (ex: falha de internet, CORS ou servidor offline)
        throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está online.');
    }
}
