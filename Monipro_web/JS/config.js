// JS/config.js — valor por omissão para desenvolvimento local (fora do container Nginx).
// Em produção este ficheiro é gerado a partir de JS/config.js.template pelo arranque do
// Nginx (envsubst), usando a variável de ambiente API_BASE_URL do docker-compose.yml.
window.MONIPRO_CONFIG = {
    API_BASE_URL: "https://moni-pro.app.br"
};
