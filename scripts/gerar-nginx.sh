#!/bin/bash
# gerar-nginx.sh
# Le as rotas registradas em src/app.js (app.use/app.get/app.post/... na raiz)
# e gera automaticamente a config do Nginx para o MoniPro.

set -e

PROJETO_DIR="$HOME/MoniPro-beta"
APP_JS="$PROJETO_DIR/src/app.js"
NGINX_CONF="/etc/nginx/sites-available/moni-pro.app.br"
DOMINIO="moni-pro.app.br"
DOMINIO_WWW="www.moni-pro.app.br"
PORTA_BACKEND=3000
PORTA_FRONTEND=8080

if [ ! -f "$APP_JS" ]; then
    echo "❌ Não encontrei $APP_JS. Ajuste a variável PROJETO_DIR no script."
    exit 1
fi

PREFIXOS=$(grep -oP "app\.(use|get|post|put|delete)\(\s*['\"]\/\K[a-zA-Z0-9_-]+" "$APP_JS" | sort -u | paste -sd '|')

if [ -z "$PREFIXOS" ]; then
    echo "❌ Nenhum prefixo de rota encontrado em $APP_JS. Abortando (config não alterada)."
    exit 1
fi

echo "🔎 Rotas de backend detectadas: $PREFIXOS"

sudo tee "$NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    server_name $DOMINIO $DOMINIO_WWW;

    location ~ ^/($PREFIXOS)(/|\$) {
        proxy_pass http://127.0.0.1:$PORTA_BACKEND;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:$PORTA_FRONTEND;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

echo "📝 Config escrita em $NGINX_CONF"

sudo nginx -t

sudo systemctl reload nginx

echo "✅ Nginx atualizado e recarregado com sucesso."
