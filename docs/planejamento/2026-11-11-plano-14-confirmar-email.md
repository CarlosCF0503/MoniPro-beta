# Confirmar o e-mail no cadastro

> MoniPro · plano 14 de 14

Hoje o cadastro só confere o formato do e-mail (z.email() na API e type="email" na tela) e se ele já existe para o mesmo perfil. A conta fica ativa na hora, então dá para criar conta com e-mail digitado errado ou de outra pessoa. Quem errou o e-mail também perde o "esqueci a senha", porque o link vai para o endereço errado.

## Situação (registrada em 22/11/2026)

Implementado no PR #76, em produção pelo release #77 (13/11/2026), com todas as sugestões aceitas. Acréscimo: POST /auth/email/corrigir, que exige a senha, para quem digitou o e-mail errado. Especificação v7.3: RF-018 e RN-017.

## Ficha

| Item       | Valor                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Prioridade | P1                                                                                                                         |
| Risco      | Alto                                                                                                                       |
| Esforço    | 3 a 4 dias                                                                                                                 |
| Trilha     | Revisão de design + testes de autorização                                                                                  |
| Depende de | Plano 1 (já na develop): reaproveita o serviço de e-mail, o Brevo, o padrão de token com hash e os limites por e-mail e IP |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): a fazer antes do PR: cadastro, confirmar_email e login.

## Requisitos para a especificação

- **RF-018 (novo):** Ao se cadastrar, o usuário recebe um link de confirmação no e-mail informado. A conta só permite entrar depois que o link for aberto. O usuário pode pedir um link novo pela tela de login.
- **RN-017 (nova):** O link de confirmação vale 48 horas e uma única vez. Pedir um novo invalida os anteriores. Conta não confirmada em 7 dias é apagada, o que libera o e-mail e a matrícula.
- **RN-009 (ajuste):** Redefinir a senha pelo link do e-mail também confirma o e-mail, porque prova que a pessoa tem acesso a ele.
- **RNF (segurança):** O aviso "confirme seu e-mail" só aparece depois de a senha estar certa, e o pedido de link novo responde sempre igual, exista a conta ou não. Nenhuma das duas telas revela quais e-mails estão cadastrados. O token fica guardado só como hash SHA-256.

## Decisões do time antes de começar

- Contas que já existem: considerar todas confirmadas na migração (sugestão, para ninguém ficar trancado do lado de fora) ou pedir a confirmação no próximo login.
- Conta não confirmada: bloquear o login (sugestão, mais simples e sem estado intermediário nas telas) ou deixar entrar com uma faixa de aviso e sem poder marcar ou criar vaga.
- Restringir o cadastro ao domínio institucional da UniEVANGÉLICA? Fecha o uso de matrícula alheia com e-mail pessoal, mas exige saber os domínios de aluno e de monitor. Fica fora deste plano se o time não decidir agora.
- Prazos: 48 horas para o link e 7 dias para a conta pendente.
- Na pilha E2E, a confirmação fica desligada por variável (EXIGIR_CONFIRMACAO_EMAIL=false, como os limites relaxados de lá), e o fluxo é coberto pela integração com Postgres real. A alternativa é o E2E ler o link de um transporte de teste.

## Modelo de dados

```
model Usuario {
  // ...
  criado_em           DateTime  @default(now())  // conta o prazo da conta pendente (RN-017)
  email_confirmado_em DateTime?                  // null = ainda não confirmou
  tokens_confirmacao  TokenConfirmacaoEmail[]
}

model TokenConfirmacaoEmail {
  id         Int       @id @default(autoincrement())
  id_usuario Int
  usuario    Usuario   @relation(fields: [id_usuario], references: [id], onDelete: Cascade)
  hash       String    @unique   // SHA-256 do token; o token puro só existe no e-mail
  expira_em  DateTime
  usado_em   DateTime?
  criado_em  DateTime  @default(now())

  @@index([id_usuario])
  @@map("tokens_confirmacao_email")
}

-- Na migração, se o time aceitar a sugestão: as contas atuais já valem como confirmadas
UPDATE usuarios SET email_confirmado_em = NOW() WHERE anonimizado_em IS NULL;
```

## API

| Método | Rota                      | Acesso                                                | Resposta                                                                                                       |
| ------ | ------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/cadastro (ajuste)` | Público, limite de /auth                              | 201 com "Enviamos um link para confirmar o e-mail"; a conta nasce sem confirmação                              |
| POST   | `/auth/email/confirmar`   | Público, com token, limite de /auth                   | 200; 410 token vencido, usado ou inválido                                                                      |
| POST   | `/auth/email/reenviar`    | Público, limite próprio (3/h por e-mail, 10/h por IP) | 200 sempre com a mesma mensagem; 429 no limite                                                                 |
| POST   | `/auth/login (ajuste)`    | Público                                               | 403 com codigo "email_nao_confirmado" quando a senha está certa e a conta não foi confirmada; o resto não muda |

## Telas e arquivos

| Arquivo                                                     | O que muda                                                                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cadastro.html e JS/cadastro.js`                            | depois do 201, em vez de ir para o login, mostra "Confira seu e-mail" com o endereço digitado, o botão "Reenviar link" e "E-mail errado? Cadastre de novo" (a conta errada some em 7 dias) |
| `confirmar_email.html, JS/confirmar_email.js e CSS (novos)` | abre pelo link do e-mail: confirmando, confirmado (botão Entrar) e link vencido (botão para pedir outro). Segue o visual de redefinir_senha.html                                           |
| `index.html e JS/login.js`                                  | no 403 "email_nao_confirmado", mostra o aviso e o botão "Reenviar link de confirmação" no lugar do toast de erro                                                                           |
| `src/services/email/modelos.js`                             | modelo "confirmar-email", no mesmo molde do "redefinir-senha"                                                                                                                              |
| `privacidade.html`                                          | acrescenta o prazo de 7 dias da conta pendente e o do token                                                                                                                                |

## Etapas

1. Migração: criado_em e email_confirmado_em em usuarios, tabela tokens_confirmacao_email (cascade) e o UPDATE das contas atuais. Conferir com migrate deploy num banco descartável.
2. Extrair o que o plano 1 já tem e serve aos dois: gerar o token (32 bytes, base64url), hashDoToken e consumir numa única escrita (updateMany com usado_em null e expira_em no futuro).
3. confirmacaoEmailService: gerar (invalida os abertos e envia com enviarSemEsperar), confirmar (consome o token e grava email_confirmado_em) e reenviar (mesma resposta com ou sem conta, ignora conta já confirmada ou anonimizada).
4. autenticacaoService.cadastrar chama gerar depois de criar a conta. login confere email_confirmado_em só depois do bcrypt e lança ErroEmailNaoConfirmado (403).
5. redefinicaoSenhaService.redefinir também preenche email_confirmado_em quando estiver vazio.
6. Rotas, schemas zod e limites (src/config/limites.js) para confirmar e reenviar, no molde de /senha/esqueci.
7. Retenção: privacidadeService.aplicarRetencao apaga as contas sem confirmação com mais de 7 dias e os tokens de confirmação com mais de 7 dias. scripts/retencao.js mostra as duas contagens.
8. seed.js e tests/integracao/helpers.js criam usuários já confirmados. Variável EXIGIR_CONFIRMACAO_EMAIL (padrão true) e false só no docker-compose.e2e.yml.
9. Telas, depois da prévia aprovada.

## Testes

- Cadastro devolve 201, a conta fica com email_confirmado_em null e um e-mail "confirmar-email" vai para o endereço informado (transporte de memória).
- Login com senha certa e conta não confirmada: 403 "email_nao_confirmado". Com senha errada: a mesma mensagem de sempre, sem revelar a falta de confirmação.
- Token certo confirma e o login passa a funcionar. Usado de novo: 410. Com 49 horas: 410. Pedir outro link invalida o primeiro.
- Reenviar para e-mail inexistente, para conta já confirmada e para conta pendente: a mesma resposta. Só a pendente recebe e-mail.
- Quarto pedido de reenvio na mesma hora para o mesmo e-mail: 429.
- Redefinir a senha pelo link confirma o e-mail de uma conta pendente.
- Integração: o hash gravado é diferente do token enviado. Duas confirmações simultâneas com o mesmo token: só uma consegue.
- Retenção: a conta pendente com 8 dias é apagada e libera e-mail e matrícula para um cadastro novo. A pendente com 6 dias e a confirmada antiga ficam.
- Migração: as contas que já existiam entram confirmadas e continuam entrando.

## Segurança e LGPD

Diminui o risco de guardar dado de quem não se cadastrou: hoje um e-mail de terceiro digitado errado fica no banco por tempo indeterminado, e com o plano ele some em 7 dias se ninguém confirmar. O token é dado de autenticação, removido em cascata na exclusão da conta e pela retenção. O e-mail de confirmação é transacional e diz no rodapé por que chegou ("alguém se cadastrou com este endereço; se não foi você, ignore"). O Aviso de Privacidade ganha os dois prazos novos.

## Critério de pronto

Só entra no sistema quem abriu o link mandado para o e-mail do cadastro. As contas atuais continuam funcionando, e cadastro com e-mail errado ou de outra pessoa some sozinho em 7 dias.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
