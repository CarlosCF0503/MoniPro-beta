# Evidências de P2 / R4 e P3 / R7 na homologação (09/11/2026)

- **P2 (R4):** a presença na monitoria passa a valer só com a confirmação do aluno e a do monitor, depois do horário e em até 7 dias. Com as duas, o monitor ganha +10 pontos e o aluno +2 (decisão D1).
- **P3 (R7):** a sessão sai do `localStorage` e passa para um cookie `HttpOnly`, com validade de 2 h (D2) e revogação no "sair".

## Índice

| Arquivo | O que comprova | Critério de aceite |
|---|---|---|
| `hml-sessao-e-presenca.txt`, seções 1 e 2 | O login responde sem token no corpo; o cookie `monipro_sessao` sai com `HttpOnly; Secure; SameSite=Strict` e validade de 7200 s | P3: nenhum token acessível ao JavaScript da página |
| seção 3 | A inscrição de teste ficou `concluido`, com as duas confirmações (aluno às 21h19 e monitor às 21h20 de 08/11), e o aluno tem 2 pontos | P2: pontos só com as duas confirmações |
| seção 4 | Confirmar de novo responde 400 e os pontos continuam 2 | P2: crédito uma única vez |
| seção 5 | O aluno chamando a rota de confirmação do monitor recebe 403 | P2: só o monitor confirma pelo lado do monitor |
| seção 6 | Uma requisição de outro site (`Origin` diferente) recebe 403 | P3: proteção contra CSRF |
| seção 7 | O cookie copiado antes do "sair" recebe 401 depois dele | P3: revogação da sessão |
| seção 8 | O monitor de teste tem 10 pontos | P2: +10 para o monitor |

## Contexto

- A confirmação de presença foi feita pelas telas em 08/11, às 21h20 UTC: o aluno confirmou pelo celular e o monitor pelo computador, com as contas de teste `aluno.teste` (id 9) e `monitor.teste` (id 10). Este registro, de 09/11, confere o resultado no banco pela API e repete as checagens de P3.
- Os mesmos fluxos estão automatizados no navegador: CT-07 (sair e revogação) e CT-11 (confirmação dos dois lados), em [`../r1-testes/`](../r1-testes/).
- PRs: #57 (P2), #61 e #62 (P3), #63 (Cache-Control das páginas). Em 09/11 eles estavam na develop e na hml. A ida para a produção travou no deploy (ver [`../deploy-producao/`](../deploy-producao/)).

## O que foi ocultado

O token da sessão (`eyJ…[omitido]`) e a senha das contas de teste.
