FROM nginx:alpine



# Copia a configuração personalizada do Nginx para o diretório padrão do container

COPY nginx.conf /etc/nginx/conf.d/default.conf



# Copia todos os arquivos (HTML, CSS, JS) para o diretório padrão do Nginx

COPY . /usr/share/nginx/html



EXPOSE 80
