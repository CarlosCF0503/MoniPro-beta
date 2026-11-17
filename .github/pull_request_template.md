## O que muda

<!-- Uma ou duas frases: o problema e a solução. Cite o requisito ou a regra (RF-xxx, RN-xxx) e a issue, se houver (Closes #xx). -->

## Como testar

<!-- Passos para conferir na homologação ou localmente: contas, telas, chamadas da API. -->

## Checklist

- [ ] A branch saiu da `develop` e o PR é para a `develop` (só a promoção para produção vai para a `main`)
- [ ] `npm test` e `npm run lint` passam localmente
- [ ] Testes novos ou ajustados para o comportamento alterado
- [ ] Migração do Prisma criada, se o `schema.prisma` mudou (`npx prisma migrate dev --name ...`)
- [ ] Variável nova documentada no `.env.example`
- [ ] Prefixo novo da API incluído em `e2e/pilha/gateway.conf` e avisado para entrar no Nginx do servidor
- [ ] Telas conferidas no computador e no celular, com capturas abaixo
- [ ] README atualizado, se mudou funcionalidade, comando ou endpoint
- [ ] Nenhum segredo, `.env` ou dado pessoal real no diff

## Capturas

<!-- Antes e depois, quando houver mudança de tela. -->
