FROM node:22-alpine



WORKDIR /app



# Copia os arquivos de dependência

COPY package*.json ./



# COPIA A PASTA DO PRISMA ANTES DA INSTALAÇÃO

COPY prisma ./prisma/



# Instala as dependências (o postinstall do Prisma vai rodar com sucesso aqui)

RUN npm install



# Copia o restante do código da API (pasta src, etc)

COPY . .



# Expõe a porta que o Express utiliza

EXPOSE 3000



# Inicia o servidor apontando para o arquivo principal

CMD ["node", "src/server.js"]
