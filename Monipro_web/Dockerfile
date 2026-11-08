FROM nginx:alpine

# Configuração personalizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Tarefa 41 / SonarQube docker:S6470: copia só os artefatos estáticos do site, em vez de
# "COPY . ", que levava para a imagem publicada o Dockerfile, o nginx.conf e qualquer arquivo
# esquecido na pasta.
COPY *.html /usr/share/nginx/html/
COPY CSS/ /usr/share/nginx/html/CSS/
COPY JS/ /usr/share/nginx/html/JS/
COPY IMG/ /usr/share/nginx/html/IMG/
# Fonte Inter hospedada no site (a CSP font-src 'self' bloqueia o Google Fonts); ver CSS/fontes.css
COPY fonts/ /usr/share/nginx/html/fonts/

# Template do JS/config.js: o entrypoint padrão da imagem nginx roda envsubst sobre os
# arquivos de /etc/nginx/templates no arranque do container, gerando JS/config.js a partir
# da variável de ambiente API_BASE_URL (ver docker-compose.yml). O config.js estático
# copiado acima serve de fallback para quem rodar a pasta fora do container.
COPY JS/config.js.template /etc/nginx/templates/config.js.template

ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html/JS

ENV API_BASE_URL=https://moni-pro.app.br

# Tarefa 41 / SonarQube docker:S6471: o Nginx roda como o usuário "nginx" (já existe na
# imagem base), não como root. Para isso:
# - o PID vai para /tmp (o diretório /run é do root);
# - a diretiva "user" sai do nginx.conf (só tem efeito quando o master roda como root);
# - o cache, a saída do envsubst (JS/) e o conf.d (ajuste de IPv6 do entrypoint) ficam
#   graváveis pelo usuário nginx.
# A porta 80 continua funcionando sem root: o Docker libera portas baixas dentro do
# container (net.ipv4.ip_unprivileged_port_start=0), então o docker-compose.yml não muda.
RUN sed -i -e 's,^pid .*,pid /tmp/nginx.pid;,' -e '/^user /d' /etc/nginx/nginx.conf \
    && chown -R nginx:nginx /var/cache/nginx /usr/share/nginx/html/JS /etc/nginx/conf.d

USER nginx

EXPOSE 80
