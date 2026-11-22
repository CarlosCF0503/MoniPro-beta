# Adicionar à agenda (.ics)

> MoniPro · plano 10 de 14

O aluno marca a monitoria e precisa lembrar sozinho. Um arquivo .ics coloca o horário na agenda do celular com um toque, sem integração com Google.

## Situação (registrada em 22/11/2026)

Implementado no PR #96, em produção pelo release #97 (20/11/2026), para o aluno e também para o monitor. Testado no Outlook e no Google Agenda do Android. Especificação v7.3: RF-015.

## Ficha

| Item       | Valor           |
| ---------- | --------------- |
| Prioridade | P3              |
| Risco      | Baixo           |
| Esforço    | 1 dia           |
| Trilha     | Revisão simples |
| Depende de | Nenhuma         |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Perfil do aluno com Adicionar à agenda.

## Requisitos para a especificação

- **RF-015 (novo):** Em cada inscrição futura, o aluno baixa um arquivo .ics com disciplina, horário, local, monitor e alarme 1h antes.

## Modelo de dados

```
// Sem mudança no banco. O arquivo é montado no navegador a partir dos dados que a tela já tem.
```

## API

| Método  | Rota                  | Acesso | Resposta                                                                             |
| ------- | --------------------- | ------ | ------------------------------------------------------------------------------------ |
| Nenhuma | `Gerado no navegador` | —      | Opcional depois: link no e-mail de lembrete (plano 3) para GET /agendamentos/:id/ics |

## Telas e arquivos

| Arquivo                                  | O que muda                                                     |
| ---------------------------------------- | -------------------------------------------------------------- |
| `perfil_aluno.html / JS/perfil/aluno.js` | botão Adicionar à agenda em Próximas e nos detalhes do celular |

## Etapas

1. Função textoIcs(inscricao) isolada e testada (escape de vírgula, ponto e vírgula e quebra de linha; CRLF; horários em UTC).
2. Download por Blob e link temporário.
3. Teste manual em Android (Google Agenda), iPhone e Outlook.

## Testes

- Local com vírgula sai escapado.
- DTSTART em UTC com sufixo Z.
- UID estável por inscrição (baixar de novo atualiza em vez de duplicar).

## Segurança e LGPD

O arquivo fica só no aparelho do aluno; nada é enviado ao servidor.

## Critério de pronto

O aluno coloca a monitoria na agenda do celular em dois toques.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
