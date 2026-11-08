// src/utils/cookies.js
// Lê um cookie do cabeçalho Cookie sem depender do cookie-parser (só a API usa um cookie).

function lerCookie(req, nome) {
    const cabecalho = req.headers.cookie;
    if (!cabecalho) return null;
    for (const parte of cabecalho.split(';')) {
        const igual = parte.indexOf('=');
        if (igual === -1) continue;
        if (parte.slice(0, igual).trim() !== nome) continue;
        const valor = parte.slice(igual + 1).trim();
        try {
            return decodeURIComponent(valor);
        } catch {
            return valor;
        }
    }
    return null;
}

module.exports = { lerCookie };
