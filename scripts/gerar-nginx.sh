#!/bin/bash
# gerar-nginx.sh
# Lê as rotas registradas em src/app.js (app.use/app.get/app.post/... na raiz),
# gera a config do Nginx para o MoniPro e garante HTTPS via Certbot/Let's Encrypt.
#
# O endereço oficial é https://moni-pro.app.br. O www.moni-pro.app.br redireciona
# para ele (301) assim que existir o registro DNS do www e o certificado o incluir:
# o script amplia o certificado sozinho quando o www passa a resolver.
#
# Uso:
#   ./scripts/gerar-nginx.sh
#   PROJETO_DIR=~/outro-checkout ./scripts/gerar-nginx.sh
#
# Requer sudo para escrever em /etc/nginx, /etc/letsencrypt e recarregar o Nginx.

set -e

PROJETO_DIR="${PROJETO_DIR:-$HOME/moni-pro-beta}"
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
    echo "❌ Não encontrei $APP_JS. Ajuste PROJETO_DIR (padrão: ~/moni-pro-beta)."
    exit 1
fi

PREFIXOS=$(grep -oP "app\.(use|get|post|put|delete)\(\s*['\"]\/\K[a-zA-Z0-9_-]+" "$APP_JS" | sort -u | paste -sd '|')

if [ -z "$PREFIXOS" ]; then
    echo "❌ Nenhum prefixo de rota encontrado em $APP_JS. Abortando (config não alterada)."
    exit 1
fi

echo "🔎 Rotas de backend detectadas: $PREFIXOS"

sudo mkdir -p "$WEBROOT"

# O www só entra no certificado quando tiver registro DNS; sem isso o Let's Encrypt recusa.
www_resolve() {
    getent hosts "$DOMINIO_WWW" > /dev/null 2>&1
}
cert_tem_www() {
    sudo openssl x509 -in "$CERT_PATH" -noout -ext subjectAltName 2> /dev/null | grep -q "DNS:$DOMINIO_WWW"
}

# Blocos de proxy, iguais em HTTP e HTTPS
LOCAIS="    location ~^/($PREFIXOS)(/|\$) {
        proxy_pass http://127.0.0.1:$PORTA_BACKEND;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:$PORTA_FRONTEND;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }"

# 1) Sem certificado ainda: config só em HTTP, necessária para o desafio do Certbot.
#    Com certificado, este passo é pulado: a config HTTPS já atende o desafio na porta 80,
#    e o site não fica sem HTTPS enquanto o script roda.
if ! sudo test -f "$CERT_PATH"; then
    sudo tee "$NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    server_name $DOMINIO $DOMINIO_WWW;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root $WEBROOT;
    }

$LOCAIS
}
EOF
    sudo nginx -t
    sudo systemctl reload nginx
fi

# 2) Certificado: emite se não existe; amplia para o www quando ele passa a resolver.
DOMINIOS_CERT=(-d "$DOMINIO")
if www_resolve; then
    DOMINIOS_CERT+=(-d "$DOMINIO_WWW")
else
    echo "ℹ️  $DOMINIO_WWW não tem registro DNS; o certificado fica só com $DOMINIO."
fi

if ! sudo test -f "$CERT_PATH"; then
    echo "🔐 Nenhum certificado encontrado. Solicitando ao Let's Encrypt..."
    sudo certbot certonly --webroot -w "$WEBROOT" --cert-name "$DOMINIO" "${DOMINIOS_CERT[@]}" \
        --non-interactive --agree-tos -m "$EMAIL" --deploy-hook "systemctl reload nginx" || {
        echo "⚠️  Não foi possível gerar o certificado agora. Seguindo apenas em HTTP."
    }
elif www_resolve && ! cert_tem_www; then
    echo "🔐 Ampliando o certificado para incluir $DOMINIO_WWW..."
    sudo certbot certonly --webroot -w "$WEBROOT" --cert-name "$DOMINIO" --expand "${DOMINIOS_CERT[@]}" \
        --non-interactive --agree-tos -m "$EMAIL" --deploy-hook "systemctl reload nginx" || {
        echo "⚠️  Não foi possível ampliar o certificado. O www continua sem HTTPS."
    }
fi

# 3) Com certificado: HTTPS no domínio oficial, HTTP sempre para https://$DOMINIO e,
#    se o certificado cobre o www, o www em HTTPS também redireciona para o domínio oficial.
if sudo test -f "$CERT_PATH"; then
    echo "🔒 Certificado encontrado. Gerando config com HTTPS + redirect."

    BLOCO_WWW=""
    if cert_tem_www; then
        BLOCO_WWW="
server {
    listen 443 ssl;
    server_name $DOMINIO_WWW;
    server_tokens off;

    ssl_certificate     $CERT_PATH;
    ssl_certificate_key $KEY_PATH;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    return 301 https://$DOMINIO\$request_uri;
}"
    fi

    sudo tee "$NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    server_name $DOMINIO $DOMINIO_WWW;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root $WEBROOT;
    }

    location / {
        return 301 https://$DOMINIO\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMINIO;
    server_tokens off;

    ssl_certificate     $CERT_PATH;
    ssl_certificate_key $KEY_PATH;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

$LOCAIS
}
$BLOCO_WWW
EOF
    sudo nginx -t
    sudo systemctl reload nginx
    if cert_tem_www; then
        echo "✅ Nginx com HTTPS em https://$DOMINIO; $DOMINIO_WWW redireciona para ele."
    else
        echo "✅ Nginx com HTTPS em https://$DOMINIO. Falta o DNS do www para o redirect em HTTPS."
    fi
else
    echo "✅ Nginx atualizado e recarregado (somente HTTP por enquanto)."
fi
