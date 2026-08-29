FROM nginx:alpine



# Copia a configuração personalizada do Nginx para o diretório padrão do container

COPY nginx.conf /etc/nginx/conf.d/default.conf



# Copia todos os arquivos (HTML, CSS, JS) para o diretório padrão do Nginx

COPY . /usr/share/nginx/html



# Template do JS/config.js: o entrypoint padrão da imagem nginx roda envsubst sobre os
# arquivos de /etc/nginx/templates no arranque do container, gerando JS/config.js a partir
# da variável de ambiente API_BASE_URL (ver docker-compose.yml). O config.js estático
# copiado acima serve de fallback para quem rodar a pasta fora do container.

COPY JS/config.js.template /etc/nginx/templates/config.js.template

ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html/JS

ENV API_BASE_URL=https://moni-pro.app.br



EXPOSE 80
