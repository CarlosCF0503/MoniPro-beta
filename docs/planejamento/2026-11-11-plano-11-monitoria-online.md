# Monitoria on-line

> MoniPro · plano 11 de 14

Hoje o campo local é texto livre, e monitores já escrevem links nele. O link fica visível para qualquer pessoa logada, inclusive quem não se inscreveu.

## Situação (registrada em 22/11/2026)

Implementado no PR #92, em produção pelo release #93 (19/11/2026). Decisões: só links https do Meet, Teams, Zoom e Jitsi; trocar a modalidade ou o link conta como mudança de local. Especificação v7.3: RF-016.

## Ficha

| Item       | Valor                      |
| ---------- | -------------------------- |
| Prioridade | P3                         |
| Risco      | Médio                      |
| Esforço    | 2 dias                     |
| Trilha     | Testes de regra + revisão  |
| Depende de | Plano 3 (link no lembrete) |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Criar vaga on-line.

## Requisitos para a especificação

- **RF-016 (novo):** A vaga é presencial (com local) ou on-line (com link de sala).
- **RN (nova):** O link só é enviado a quem está inscrito: no perfil, nos detalhes da inscrição e no lembrete por e-mail. Só links https.

## Decisões do time antes de começar

- Lista de domínios aceitos (Meet, Teams, Zoom, Jitsi) ou qualquer https.

## Modelo de dados

```
enum Modalidade { presencial online }

model Monitoria {
  // ...
  modalidade Modalidade @default(presencial)
  link       String?    // só com modalidade online; nunca devolvido na listagem pública
}
```

## API

| Método       | Rota                        | Acesso    | Resposta                           |
| ------------ | --------------------------- | --------- | ---------------------------------- |
| POST / PATCH | `/monitorias`               | isMonitor | modalidade e link validados no zod |
| GET          | `/monitorias/:idDisciplina` | Logado    | sem o campo link                   |
| GET          | `/perfil/agendamentos`      | Aluno     | com link nas inscrições ativas     |

## Telas e arquivos

| Arquivo                                     | O que muda                                                |
| ------------------------------------------- | --------------------------------------------------------- |
| `marcar_monitoria.html (JS/marcar/tela.js)` | escolha Presencial / On-line, campo Link da sala, revisão |
| `Card da vaga`                              | chip On-line no lugar do local                            |
| `perfil_aluno.html`                         | botão Entrar na sala perto do horário                     |

## Etapas

1. Migração com default presencial (vagas atuais não mudam).
2. Zod: link obrigatório e https quando on-line; proibido quando presencial.
3. Remover link do select da listagem pública e incluir só na consulta de inscrições do próprio aluno.
4. Telas (prévia aprovada).

## Testes

- Listagem pública nunca traz link.
- Aluno não inscrito não acessa o link por nenhuma rota.
- Link http ou javascript: dá 400.
- Vaga presencial com link: 400.

## Segurança e LGPD

Nada novo. O link pode dar acesso a uma sala: tratá-lo como dado restrito nos logs (não registrar).

## Critério de pronto

Monitorias on-line funcionam sem expor o link da sala para quem não se inscreveu.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
