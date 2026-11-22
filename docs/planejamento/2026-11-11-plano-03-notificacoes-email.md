# Notificações por e-mail

> MoniPro · plano 3 de 14

Nenhum aviso sai do sistema. Quando o monitor cancela, o aluno só descobre ao chegar na sala, e a especificação não diz quem avisa (pergunta em aberto da RN-001).

## Situação (registrada em 22/11/2026)

Implementado no PR #78, em produção pelo release #79 (16/11/2026). Decisões: só o aluno recebe avisos; a fila é processada pelo próprio backend a cada 60 segundos, sem cron no servidor; o lembrete sai entre 20 e 24 horas antes; o aviso da lista de espera entrou com o plano 8. Especificação v7.3: RF-010 e RN-011.

## Ficha

| Item       | Valor                                            |
| ---------- | ------------------------------------------------ |
| Prioridade | P1                                               |
| Risco      | Médio                                            |
| Esforço    | 4 a 5 dias                                       |
| Trilha     | Testes de regra + revisão                        |
| Depende de | Provedor de e-mail decidido (o mesmo do plano 1) |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Os seis e-mails.

## Requisitos para a especificação

- **RF-010 (novo):** O sistema envia e-mail ao aluno quando ele se inscreve, quando a vaga muda ou é cancelada, 24h antes da sessão e quando sai da lista de espera.
- **RN-011 (nova):** Avisos sobre monitorias são transacionais e não podem ser desligados. Nenhum e-mail de divulgação é enviado.
- **RNF (confiabilidade):** Uma falha do provedor não desfaz nem atrasa a ação do usuário: o envio passa por uma fila no banco com novas tentativas.

## Decisões do time antes de começar

- Provedor e domínio de envio (nao-responda@moni-pro.app.br exige SPF e DKIM no registro.br).
- Se o monitor também recebe aviso quando alguém se inscreve (sugestão: não no início, só um resumo diário depois).

## Modelo de dados

```
enum StatusNotificacao { pendente enviada falhou }

model Notificacao {
  id             Int                @id @default(autoincrement())
  id_usuario     Int
  usuario        Usuario            @relation(fields: [id_usuario], references: [id], onDelete: Cascade)
  modelo         String             // inscricao | lembrete | alterada | cancelada | espera | senha
  dados          Json               // só o que o modelo precisa (disciplina, horário, local)
  chave          String             @unique  // ex.: "lembrete:agendamento:108" (evita duplicar)
  status         StatusNotificacao  @default(pendente)
  tentativas     Int                @default(0)
  enviar_apos    DateTime           @default(now())
  enviada_em     DateTime?
  criado_em      DateTime           @default(now())

  @@index([status, enviar_apos])
  @@map("notificacoes")
}
```

## API

| Método                    | Rota                      | Acesso                        | Resposta                                    |
| ------------------------- | ------------------------- | ----------------------------- | ------------------------------------------- |
| Nenhuma rota pública nova | `scripts/notificacoes.js` | Cron no servidor a cada 5 min | Envia pendentes; após 5 falhas marca falhou |

## Telas e arquivos

| Arquivo                        | O que muda                                                         |
| ------------------------------ | ------------------------------------------------------------------ |
| `Modelos de e-mail (novos)`    | src/services/email/modelos.js com HTML de tabela e versão em texto |
| `Nenhuma tela do sistema muda` | o aviso de privacidade ganha uma frase sobre e-mails transacionais |

## Etapas

1. Migração da tabela notificacoes.
2. notificacaoService.enfileirar(usuario, modelo, dados, chave), chamado dentro da mesma transação da ação (inscrição, cancelamento, edição).
3. scripts/notificacoes.js: pega até 50 pendentes com enviar_apos vencido, envia, marca enviada; erro soma tentativa e adia (1, 5, 15, 60 min).
4. Lembrete: o mesmo script enfileira lembretes das sessões que começam entre 24h e 24h15 (chave única impede duplicar).
5. Cron no servidor Oracle (crontab do usuário do deploy), com log em arquivo e rotação.
6. SPF e DKIM do domínio de envio; teste de entrega para Gmail e Outlook institucional.
7. Frase no aviso de privacidade.

## Testes

- Inscrição enfileira exatamente um e-mail "inscricao".
- Rodar o script duas vezes não envia o lembrete duas vezes.
- Provedor fora do ar: a inscrição responde 201 e a notificação fica pendente com tentativa 1.
- Cancelamento da vaga com 3 inscritos enfileira 3 e-mails.
- Conta excluída: as notificações pendentes somem (cascade).

## Segurança e LGPD

Base legal: execução do serviço. dados guarda só o necessário; notificações enviadas são apagadas pelo scripts/retencao.js depois de 90 dias. O aviso de privacidade passa a citar o provedor como operador.

## Critério de pronto

Todo aluno afetado por uma mudança recebe e-mail em até 10 minutos, e uma queda do provedor não quebra nenhuma tela.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
