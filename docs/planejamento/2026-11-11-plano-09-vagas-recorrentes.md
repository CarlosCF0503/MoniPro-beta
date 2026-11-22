# Vagas recorrentes

> MoniPro · plano 9 de 14

O monitor que atende toda terça às 18h precisa criar a vaga semana a semana. É a tarefa mais repetitiva do sistema para quem mais o alimenta.

## Situação (registrada em 22/11/2026)

Implementado no PR #100, em produção pelo release #101 (21/11/2026). "Cancelar esta e as próximas" entrou já nesta versão, respeitando as 24 horas de cada vaga. Especificação v7.3: RF-014.

## Ficha

| Item       | Valor                     |
| ---------- | ------------------------- |
| Prioridade | P3                        |
| Risco      | Médio                     |
| Esforço    | 2 a 3 dias                |
| Trilha     | Testes de regra + revisão |
| Depende de | Nenhuma                   |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Criar vaga que se repete.

## Requisitos para a especificação

- **RF-014 (novo):** Ao criar uma vaga, o monitor pode repeti-la toda semana até uma data, com no máximo 16 ocorrências. Cada ocorrência é uma vaga independente.
- **RN (complemento):** Datas em que o monitor já tem vaga no mesmo horário são puladas e mostradas antes de criar.

## Decisões do time antes de começar

- Se cancelar a série inteira de uma vez entra agora ou depois (o plano deixa preparado com id_serie).

## Modelo de dados

```
model Monitoria {
  // ...
  id_serie String?   // uuid compartilhado pelas ocorrências criadas juntas
  @@index([id_serie])
}
```

## API

| Método | Rota          | Acesso    | Resposta                                                                        |
| ------ | ------------- | --------- | ------------------------------------------------------------------------------- |
| POST   | `/monitorias` | isMonitor | corpo ganha repeticao { frequencia: "semanal", ate }; 201 com criadas e puladas |

## Telas e arquivos

| Arquivo                                     | O que muda                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `marcar_monitoria.html (JS/marcar/tela.js)` | campo Repetir e Até, lista das datas com as puladas, revisão e botão com o número de vagas |

## Etapas

1. Função pura gerarOcorrencias(inicio, ate, existentes) com testes.
2. monitoriaService.criar com createMany numa transação; limite de 16 no zod.
3. Tela (prévia aprovada).

## Testes

- Até antes do primeiro dia: 400.
- 17 semanas: 400.
- Conflito em uma data: cria as outras e devolve puladas = 1.
- Horário de verão não existe mais no Brasil, mas o teste usa datas em UTC para não depender do fuso.

## Segurança e LGPD

Nada novo.

## Critério de pronto

O monitor cria o semestre inteiro de uma vez e cada vaga continua podendo ser editada ou cancelada sozinha.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
