# Busca e filtros

> MoniPro · plano 13 de 14

Com poucas vagas, o calendário basta. Em disciplinas com vários monitores (Cálculo I já tem quatro na prévia), o aluno precisa abrir dia por dia para achar um horário à noite ou com o monitor de que gosta.

## Situação (registrada em 22/11/2026)

Implementado no PR #98, em produção pelo release #99 (21/11/2026). Decisões: filtros no navegador e na API; manhã até 11:59, tarde de 12:00 a 17:59, noite a partir de 18:00; "só com lugar livre" esconde todas as lotadas. Especificação v7.3: RF-017.

## Ficha

| Item       | Valor           |
| ---------- | --------------- |
| Prioridade | P3              |
| Risco      | Baixo           |
| Esforço    | 2 dias          |
| Trilha     | Revisão simples |
| Depende de | Nenhuma         |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Marcar com filtros.

## Requisitos para a especificação

- **RF-017 (novo):** O aluno filtra os horários por período do dia (manhã, tarde, noite), por monitor e por "só com lugar livre". O calendário e a lista mostram só o que combina.
- **RNF (desempenho):** A listagem usa os mesmos filtros no servidor, com paginação, antes de a base crescer.

## Modelo de dados

```
// Sem mudança no banco. Índice já existe em id_disciplina; somar índice em (id_disciplina, horario) se a consulta passar de 100 ms.
```

## API

| Método | Rota                                                   | Acesso | Resposta                            |
| ------ | ------------------------------------------------------ | ------ | ----------------------------------- |
| GET    | `/monitorias/:idDisciplina?periodo=&monitor=&livres=1` | Logado | mesma resposta, filtrada e paginada |

## Telas e arquivos

| Arquivo                                     | O que muda                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `marcar_monitoria.html (JS/marcar/tela.js)` | barra de filtros acima do calendário (computador) e no passo Dia (celular), Limpar filtros |

## Etapas

1. Filtros no cliente primeiro (rápido de entregar, sem mudar a API).
2. Parâmetros opcionais no zod e na consulta do repositório.
3. Tela (prévia aprovada).

## Testes

- Período noite inclui 18:30 e exclui 17:59.
- Filtro de monitor inexistente devolve lista vazia, não erro.
- Dia sem horário que combine mostra mensagem própria.

## Segurança e LGPD

Nada novo.

## Critério de pronto

O aluno acha o horário que serve sem abrir o calendário dia por dia.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
