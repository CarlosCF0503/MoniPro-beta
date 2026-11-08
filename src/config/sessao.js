// src/config/sessao.js
// P3 (R7) e decisão D2 da Fase 03: a sessão fica num cookie httpOnly de 2 h, sem renovação
// silenciosa. O JavaScript da página não consegue ler o token, então um XSS não o rouba.

const NOME_COOKIE_SESSAO = 'monipro_sessao';
const DURACAO_SESSAO_SEGUNDOS = 2 * 60 * 60;

// Frontend e API respondem pelo mesmo domínio (o Nginx do servidor encaminha /auth, /perfil
// etc. para o backend), então SameSite=Strict não atrapalha o uso normal e barra o envio do
// cookie a partir de outros sites. Secure também vale em http://localhost nos navegadores.
const opcoesCookieSessao = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/'
};

module.exports = { NOME_COOKIE_SESSAO, DURACAO_SESSAO_SEGUNDOS, opcoesCookieSessao };
