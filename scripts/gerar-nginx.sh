#!/bin/bash

# gerar-nginx.sh

# Le as rotas registradas em src/app.js (app.use/app.get/app.post/... na raiz),

# gera a config do Nginx para o MoniPro e garante HTTPS via Certbot/Let's Encrypt.

#

# Uso:

#   ./gerar-nginx.sh

#

# Requer sudo para escrever em /etc/nginx, /etc/letsencrypt e recarregar o Nginx.



set -e



PROJETO_DIR="$HOME/MoniPro-beta"

APP_JS="$PROJETO_DIR/src/app.js"

NGINX_CONF="/etc/nginx/sites-available/moni-pro.app.br"

DOMINIO="moni-pro.app.br"

DOMINIO_WWW="www.moni-pro.app.br"

PORTA_BACKEND=3000

PORTA_FRONTEND=8080

WEBROOT="/var/www/certbot"

CERT_PATH="/etc/letsencrypt/live/$DOMINIO/fullchain.pem"

KEY_PATH="/etc/letsencrypt/live/$DOMINIO/privkey.pem"

EMAIL="carlos.filho@aluno.unienvagelica.edu.br"   # <-- ajuste para o seu e-mail (avisos de renovação)



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



sudo mkdir -p "$WEBROOT"



# 1) Escreve sempre uma config HTTP básica primeiro.

#    Necessária para o Certbot validar o domínio (challenge HTTP) caso o

#    certificado ainda não exista, e serve de base antes de ligar o HTTPS.

sudo tee "$NGINX_CONF" > /dev/null << EOF

server {

    listen 80;

    server_name $DOMINIO $DOMINIO_WWW;



    location /.well-known/acme-challenge/ {

        root $WEBROOT;

    }



    location ~^/($PREFIXOS)(/|\$) {

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



sudo nginx -t

sudo systemctl reload nginx



# 2) Se ainda não existe certificado, solicita um agora (modo não interativo).

if ! sudo test -f "$CERT_PATH"; then

    echo "🔐 Nenhum certificado encontrado. Solicitando ao Let's Encrypt..."

    sudo certbot certonly --webroot -w "$WEBROOT" -d "$DOMINIO" -d "$DOMINIO_WWW" --non-interactive --agree-tos -m "$EMAIL" --deploy-hook "systemctl reload nginx" || {

        echo "⚠️  Não foi possível gerar o certificado agora. Seguindo apenas em HTTP.";

    }

fi



# 3) Se o certificado existe (recém-criado ou já existia antes), reescreve a

#    config já com HTTPS ativo e redirect automático de HTTP para HTTPS.

if sudo test -f "$CERT_PATH"; then

    echo "🔒 Certificado encontrado. Gerando config com HTTPS + redirect."

    sudo tee "$NGINX_CONF" > /dev/null << EOF

server {

    listen 80;

    server_name $DOMINIO $DOMINIO_WWW;



    location /.well-known/acme-challenge/ {

        root $WEBROOT;

    }



    location / {

        return 301 https://\$host\$request_uri;

    }

}



server {

    listen 443 ssl;

    server_name $DOMINIO $DOMINIO_WWW;



    ssl_certificate     $CERT_PATH;

    ssl_certificate_key $KEY_PATH;

    ssl_protocols       TLSv1.2 TLSv1.3;

    ssl_ciphers         HIGH:!aNULL:!MD5;

    ssl_prefer_server_ciphers on;



    location ~^/($PREFIXOS)(/|\$) {

        proxy_pass http://127.0.0.1:$PORTA_BACKEND;

        proxy_set_header Host \$host;

        proxy_set_header X-Real-IP \$remote_addr;

        proxy_set_header X-Forwarded-Proto \$scheme;

    }



    location / {

        proxy_pass http://127.0.0.1:$PORTA_FRONTEND;

        proxy_set_header Host \$host;

        proxy_set_header X-Real-IP \$remote_addr;

        proxy_set_header X-Forwarded-Proto \$scheme;

    }

}

EOF

    sudo nginx -t

    sudo systemctl reload nginx

    echo "✅ Nginx atualizado e recarregado com HTTPS ativo em https://$DOMINIO"

else

    echo "✅ Nginx atualizado e recarregado (somente HTTP por enquanto)."

fi
