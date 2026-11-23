# Recuperar senha

> MoniPro · plano 1 de 14

Hoje não existe rota para quem esqueceu a senha: a conta fica inacessível e a única saída é pedir ajuda a alguém com acesso ao banco.

## Situação (registrada em 22/11/2026)

Implementado no PR #72 (correções #73 e #74), em produção pelo release #75 (12/11/2026). Decisões: provedor Brevo, por SMTP; limite próprio de 3 pedidos por hora por e-mail e 10 por IP. Especificação v7.3: RF-008 e RN-009.

## Ficha

| Item       | Valor                                     |
| ---------- | ----------------------------------------- |
| Prioridade | P1                                        |
| Risco      | Alto                                      |
| Esforço    | 3 a 4 dias                                |
| Trilha     | Revisão de design + testes de autorização |
| Depende de | Serviço de e-mail (mesma base do plano 3) |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Login com o link; Pedir o link; Criar senha nova; E-mail do link.

## Requisitos para a especificação

- **RF-008 (novo):** O usuário pode pedir um link de redefinição informando e-mail e tipo de conta, e criar uma senha nova a partir dele.
- **RN-009 (nova):** O link vale 30 minutos e uma única vez. Pedir um novo invalida os anteriores. Trocar a senha encerra todas as sessões abertas.
- **RNF (segurança):** A resposta ao pedido é sempre a mesma, exista a conta ou não. O token fica guardado só como hash SHA-256.

## Decisões do time antes de começar

- Qual provedor de e-mail usar (SMTP institucional, Brevo ou Resend). A decisão vale para o plano 3 também.
- Se o limite de tentativas de /auth (10 a cada 15 min) cobre também o pedido de link ou se ele ganha um limite próprio (sugestão: 3 por hora por e-mail).

## Modelo de dados

```
model TokenRedefinicao {
  id         Int       @id @default(autoincrement())
  id_usuario Int
  usuario    Usuario   @relation(fields: [id_usuario], references: [id], onDelete: Cascade)
  hash       String    @unique   // SHA-256 do token; o token puro só existe no e-mail
  expira_em  DateTime
  usado_em   DateTime?
  criado_em  DateTime  @default(now())

  @@index([id_usuario])
  @@map("tokens_redefinicao")
}
```

## API

| Método | Rota                    | Acesso                  | Resposta                                                   |
| ------ | ----------------------- | ----------------------- | ---------------------------------------------------------- |
| POST   | `/auth/senha/esqueci`   | Público, limite próprio | 200 sempre com a mesma mensagem; 429 no limite             |
| POST   | `/auth/senha/redefinir` | Público, com token      | 200; 400 senha fraca; 410 token vencido, usado ou inválido |

## Telas e arquivos

| Arquivo                                                   | O que muda                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `index.html`                                              | link "Esqueci minha senha" abaixo do campo de senha             |
| `redefinir_senha.html (nova)`                             | pedir o link, resposta genérica, criar senha nova, link vencido |
| `JS/redefinir_senha.js e CSS/redefinir_senha.css (novos)` | regras de senha iguais às do cadastro, com retorno ao digitar   |

## Etapas

1. Migração com a tabela tokens_redefinicao e a relação em Usuario (cascade, para o DELETE /perfil continuar limpando tudo).
2. src/services/email/ com envio isolado atrás de uma interface (enviar(para, modelo, dados)). Em teste, um transporte de memória; em dev, log no console.
3. autenticacaoService: gerarRedefinicao (cria token aleatório de 32 bytes, guarda o hash, invalida os anteriores) e redefinirSenha (confere hash, validade e uso; grava bcrypt; incrementa versao_token).
4. Rotas e schemas zod em autenticacaoSchemas.js, reaproveitando a regra de senha do cadastro.
5. Limite em src/config/limites.js: 3 pedidos por hora por e-mail e 10 por IP.
6. Telas (prévia aprovada) e link no login.
7. Variáveis do provedor no .env do servidor de hml e prod, fora do repositório.

## Testes

- Pedido com e-mail inexistente devolve a mesma resposta e o mesmo tempo aproximado do existente.
- Token usado duas vezes: a segunda dá 410.
- Token com 31 minutos dá 410.
- Pedir um segundo link invalida o primeiro.
- Depois de redefinir, o cookie antigo recebe 401 (versao_token).
- Senha nova fraca dá 400 com a mensagem do campo.
- Integração: o hash gravado não é igual ao token enviado.

## Segurança e LGPD

O token é dado pessoal de autenticação: entra no scripts/retencao.js (apagar tokens com mais de 24h) e é removido em cascata na exclusão da conta. O e-mail não revela se a conta existe.

## Critério de pronto

Uma pessoa sem acesso à conta recupera o acesso só pelo e-mail, e ninguém consegue descobrir pela tela quais e-mails estão cadastrados.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
