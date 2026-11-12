// Porte de Monipro_web/JS/api.js (chamadaApi) e de mensagemDaApi (Monipro_web/JS/toast.js).
// escaparHtml não foi portado: o JSX já escapa o texto interpolado.

// URL base do servidor, definida em JS/config.js — gerada por ambiente no arranque do
// container Nginx (ver Monipro_web/JS/config.js.template). Fallback abaixo cobre o caso de
// config.js não ter sido carregado (ex.: script bloqueado ou faltando na página).
const MB_BETA_ORM =
    (window.MONIPRO_CONFIG && window.MONIPRO_CONFIG.API_BASE_URL) || 'https://moni-pro.app.br';

// P3 (R7): o token não fica mais no localStorage. Apaga o que versões antigas gravaram.
try {
    localStorage.removeItem('monipro_token');
    localStorage.removeItem('monipro_usuario');
} catch {
    // localStorage bloqueado (modo privado restrito): nada a limpar
}

/**
 * Função centralizada para realizar pedidos ao backend.
 * @param {string} endpoint - O caminho da rota (ex: '/auth/login', '/perfil')
 * @param {object} opcoes - Configurações do fetch (method, body, etc.)
 * @returns {Promise<object>} - A resposta do servidor (garantida como objeto)
 */
export async function chamadaApi(endpoint, opcoes = {}) {
    const cabecalhos = {
        'Content-Type': 'application/json',
        ...opcoes.headers
    };

    // P3 (R7): a sessão vai no cookie httpOnly monipro_sessao, que o navegador envia sozinho.
    // credentials: 'include' cobre também o frontend local servido em outra porta.
    const configuracao = { ...opcoes, headers: cabecalhos, credentials: 'include' };

    try {
        const resposta = await fetch(`${MB_BETA_ORM}${endpoint}`, configuracao);

        const contentType = resposta.headers.get('content-type');
        let dados = {};

        if (contentType && contentType.includes('application/json')) {
            dados = await resposta.json();
        } else {
            // Se NÃO for JSON (ex: página HTML de erro 404 ou 500),
            // cria um objeto de erro manual para evitar o crash "Unexpected token '<'"
            dados = {
                erro: true,
                mensagem: `Erro inesperado no servidor. A rota pode não existir (${resposta.status}).`
            };
        }

        // Status HTTP no objeto, para validações específicas nas telas
        dados.statusHttp = resposta.status;

        // Inclui o motivo devolvido pelo servidor e, em erro de validação, os campos recusados
        if (!resposta.ok) {
            const motivo = typeof dados.erro === 'string' ? dados.erro : dados.mensagem;
            console.warn(
                `[MoniPro] API ${opcoes.method || 'GET'} ${endpoint} → ${resposta.status}: ${motivo || 'sem mensagem'}`,
                ...(dados.campos ? [dados.campos] : [])
            );
        }

        return dados;
    } catch (erro) {
        console.error(`Erro de rede no pedido para ${endpoint}:`, erro);
        // Erro padronizado para o 'catch' das telas (falha de internet, CORS ou servidor offline)
        throw new Error(
            'Não foi possível conectar ao servidor. Verifique se o backend está online.',
            { cause: erro }
        );
    }
}

/**
 * Extrai a mensagem a exibir de uma resposta de chamadaApi().
 * O backend responde erros como { success: false, erro, campos? } (tratadorDeErros.js)
 * e sucessos com { success: true, mensagem? }.
 * @param {object} dados - Objeto retornado por chamadaApi().
 * @param {string} padrao - Texto usado quando o servidor não manda mensagem.
 * @returns {string}
 */
export function mensagemDaApi(dados, padrao) {
    if (!dados) return padrao;
    // erro: true (sem texto) é o marcador de resposta não-JSON criado em chamadaApi
    if (typeof dados.erro === 'string' && dados.erro) return dados.erro;
    return dados.mensagem || dados.message || padrao;
}

// P3 (R7): o JavaScript não lê o token (cookie httpOnly). Quem está logado vem de
// GET /auth/sessao, consultado uma vez por página e compartilhado entre os componentes.
let sessaoAtual = null;

/**
 * Usuário logado: { id, nome, tipo }, ou null se não há sessão válida (401).
 * Erros de rede sobem como exceção, para a página avisar em vez de mandar ao login.
 * @returns {Promise<{id:number, nome:string, tipo:string}|null>}
 */
export function obterSessao() {
    if (!sessaoAtual) {
        sessaoAtual = chamadaApi('/auth/sessao').then(
            (dados) => (dados.success && dados.usuario ? dados.usuario : null),
            (erro) => {
                sessaoAtual = null;
                throw erro;
            }
        );
    }
    return sessaoAtual;
}

/** Encerra a sessão no servidor (revoga o token e apaga o cookie). Não lança erro. */
export async function encerrarSessao() {
    try {
        await chamadaApi('/auth/sair', { method: 'POST' });
    } catch (erro) {
        console.warn('[MoniPro] Não foi possível avisar o servidor do "sair".', erro);
    }
    sessaoAtual = null;
}
