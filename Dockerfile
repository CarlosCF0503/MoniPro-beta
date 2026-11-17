# Imagem da API (Node.js + Express + Prisma). Mesma versão do Node usada no CI e no
# "engines" do package.json.
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Dependências primeiro, para o Docker reaproveitar esta camada quando só o código muda.
# A pasta prisma/ vem antes da instalação porque o postinstall roda "prisma generate".
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# "npm ci" instala exatamente o que está no package-lock.json e falha se ele estiver
# desatualizado. --omit=dev deixa de fora Jest, ESLint, Prettier, Playwright e nodemon.
# O CLI do Prisma (pacotes "prisma" e "@prisma/config") fica em "dependencies" porque o
# deploy roda "npx prisma migrate deploy" dentro desta imagem antes de trocar os containers.
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Código da API. Os arquivos continuam do root e só leitura para o processo: a aplicação
# não grava em disco (os logs vão para a saída padrão).
COPY . .

# Roda sem privilégios, com o usuário "node" que já existe na imagem base
USER node

EXPOSE 3000

# Consulta GET /saude (que também confere o banco). O fetch é nativo no Node 22, então a
# imagem não precisa de curl nem wget. O start-period cobre a conexão inicial com o banco.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
