MoniPro · Projeto Integrador · 7º período

# Plano de implementação da emissão de certificados (RF-005)

## Situação (registrada em 22/11/2026)

Adotado em 16/11/2026 no lugar do plano 4, com as recomendações D-C1 a D-C5 aceitas. Implementado nos PRs #83 a #88 e em produção pelo release #89 (18/11/2026); a assinatura e a revogação pela coordenação entraram com o plano 7 (PR #103). Especificação v7.3: RF-005 e RN-012.

O plano de 14/10 (`Plano_Certificados_Gamificacao_MoniPro`) previa uma "Etapa 0" de presença confiável antes dos certificados. Boa parte dela entrou na Fase 03: o monitor registra o término ao finalizar a vaga, e a presença só vale com a confirmação do aluno e do monitor. Este plano parte do código da `develop` em 11/11/2026 (4931ca1) e cobre só o que falta para emitir e verificar a declaração de horas.

5 PRs, um de cada vez Estimativa: 10 a 12 dias 5 decisões do time Situação conferida em 11/11/2026

## O que já existe e o que falta

| Peça                   | Situação    | Onde                                                                                         | O que falta para o certificado                                                                                                                                                                       |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duração da sessão      | Existe      | `Monitoria.data_fim`, gravada em `PATCH /monitorias/:id/finalizar`                           | Não tem teto: o monitor pode informar um término dias depois do início. Também aceita término no futuro.                                                                                             |
| Presença confirmada    | Existe      | `presenca_aluno_em` e `presenca_monitor_em`; o agendamento vira `concluido` com as duas (P2) | Nada. É a prova de que a sessão aconteceu.                                                                                                                                                           |
| Horário passado (R14)  | Aberto      | `src/schemas/monitoriaSchemas.js`, `agendamentoService.criar`                                | O backend aceita vaga e inscrição com horário passado. Duas contas combinadas geram uma sessão "realizada" na hora. A seção 25 da v7.2 pede a correção antes de os pontos valerem para certificados. |
| Horas no perfil        | Parcial     | `Monipro_web/JS/perfil/dados.js` (`minutosComprovados`)                                      | A tela soma `data_fim − horario` de toda vaga finalizada, com ou sem aluno presente. O número precisa vir do backend, com a mesma regra do certificado.                                              |
| Quadro "Certificados"  | Placeholder | `JS/perfil/monitor.js` (`certificadosHTML`)                                                  | Hoje diz que a emissão "chega numa próxima versão".                                                                                                                                                  |
| Entidade `Certificado` | Não existe  | DER da v7.2 (tracejada)                                                                      | Modelo, migração, rotas, página do documento e verificação pública.                                                                                                                                  |
| Perfil Administrador   | Não existe  | Decisão de 17/10 (RF-001)                                                                    | Fica fora deste plano. Até ele existir, a revogação é feita por script no servidor (PR 5).                                                                                                           |

## Regra da carga horária

Uma única função no backend calcula as horas, e ela é usada pela elegibilidade, pela emissão e pelo número "Horas comprovadas" do perfil. Assim a tela, o certificado e a verificação nunca mostram valores diferentes.

### Quando a sessão conta

A vaga está `realizada` ou `concluida`, tem `data_fim` e tem **pelo menos um agendamento `concluido`** (aluno e monitor confirmaram).

### Quanto ela vale

`data_fim − horario`, limitado a 4h por sessão. O teto também passa a ser validado na finalização (PR 1).

### Em que período entra

No semestre do `horario`, no fuso de São Paulo: janeiro a junho é `2026.1`, julho a dezembro é `2026.2` (decisão D-C5).

### Efeito colateral visível

As vagas finalizadas antes da P2 (08/11) não têm presença confirmada, então saem da conta. O número "Horas comprovadas" do perfil vai cair para os monitores que tinham sessões antigas. Vale avisar no PR 2 e na seção 7 do documento.

## Ordem dos PRs

Todos partem da `develop`. O próximo só é aberto depois que o anterior entrou (lição do \#58/#59: o time mescla em sequência rápida e PR empilhado cai na branch errada). Cada PR que muda tela tem antes a prévia da página completa num artefato.

PR 1 · R14 e teto→PR 2 · Elegibilidade→PR 3 · Emissão→PR 4 · Verificação→PR 5 · Revogação e E2E

| PR    | Entrega                                                                              | Risco | Migração | Tela                                       | Estimativa |
| ----- | ------------------------------------------------------------------------------------ | ----- | -------- | ------------------------------------------ | ---------- |
| **1** | R14: recusar horário passado; teto e limite de término na finalização                | Alto  | Não      | Só mensagens de erro                       | 1–2 d      |
| **2** | Regra das horas, `GET /certificados/elegibilidade`, perfil lendo o número do backend | Médio | Não      | Perfil do monitor (números)                | 2 d        |
| **3** | Modelo `Certificado`, emissão, listagem e página do certificado                      | Alto  | Sim      | Quadro "Certificados" e `certificado.html` | 3–4 d      |
| **4** | Verificação pública por código                                                       | Médio | Não      | `verificar.html`                           | 1–2 d      |
| **5** | Revogação por script, casos E2E e evidências                                         | Baixo | Não      | Não                                        | 2 d        |

PR 1

## Fechar o R14 e limitar a finalização

Sem isso, o certificado herda a fraude barata que a seção 25 já registra. Área de risco alto (pontos e presença): testes de autorização e conferência na hml com as contas de teste.

- Criar vaga com `horario` no passado: **400** no zod de `monitoriaSchemas.js`, com tolerância de 5 minutos para relógio.
- Inscrever-se numa vaga que já começou: **422** em `agendamentoService.criar`, usando o horário gravado no banco (não o do corpo).
- Finalizar com `data_fim` no futuro (além de 5 minutos) ou mais de 4h depois do início: **400** em `monitoriaService.finalizar`. O seletor de término (`opcoesTermino`) passa a oferecer só até 4h.
- Constantes novas em `src/utils/regrasConclusao.js` (`MINUTOS_MAX_SESSAO = 240`), ao lado das que já existem.

### Cuidado com o seed do E2E

O `docker-compose.e2e.yml` e os testes de integração criam vagas passadas para testar a confirmação de presença. Eles precisam gravar direto pelo repositório (ou pelo Prisma), sem passar pela rota que agora recusa.

PR 2

## Regra das horas e elegibilidade

Só leitura. Já entrega valor sozinho, porque corrige o número do perfil e mostra ao monitor o que falta para cada sessão contar.

```
// GET /certificados/elegibilidade?periodo=2026.2   (isMonitor)
{
  "periodo": "2026.2",
  "minutos": 450,
  "sessoes": 6,
  "minimo_minutos": 60,
  "pode_emitir": true,
  "por_disciplina": [{ "disciplina": "Cálculo I", "minutos": 270 }],
  "pendentes": {
    "a_finalizar": 2,          // horário passou, vaga sem data_fim
    "sem_presenca": 1          // finalizada, nenhum aluno com dupla confirmação
  }
}
```

- Arquivos novos: `src/services/certificadoService.js`, `src/repositories/certificadoRepository.js`, `src/routes/certificadoRotas.js`, `src/schemas/certificadoSchemas.js` e `src/utils/cargaHoraria.js` (função pura, fácil de testar).
- A soma é feita no Postgres numa consulta só (`LEAST(EXTRACT(EPOCH FROM data_fim - horario)/60, 240)` com `EXISTS` de agendamento concluído), para não trazer todas as vagas para o Node.
- `minimo_minutos` vem de `CERT_MINIMO_MINUTOS` no `.env`, com padrão 60 (D-C1).
- Perfil do monitor: "Horas comprovadas", a aba Horas do celular e as barras por disciplina passam a usar a resposta da API. `minutosComprovados` de `dados.js` sai.
- **Nginx:** `/certificados` é um prefixo novo. Conferir que o `gerar-nginx.sh` o detecta, regerar o Nginx na hml e em prod no deploy (na hml isso não é automático, foi o que aconteceu com o `/saude`) e incluir o prefixo no `e2e/pilha/gateway.conf`, que é fixo.

PR 3

## Modelo, emissão e página do certificado

```
enum SituacaoCertificado { valido substituido revogado }

model Certificado {
  id               Int                 @id @default(autoincrement())
  codigo           String              @unique   // 128 bits aleatórios em base32, nunca o id
  id_usuario       Int
  usuario          Usuario             @relation(fields: [id_usuario], references: [id])
  periodo          String              // "2026.2"
  carga_minutos    Int
  snapshot         Json                // nome, período e lista de sessões congelados na emissão
  situacao         SituacaoCertificado @default(valido)
  emitido_em       DateTime            @default(now())
  revogado_em      DateTime?
  motivo_revogacao String?

  @@index([id_usuario, periodo])
  @@map("certificados")
}
-- Na migração, à mão: um único certificado válido por pessoa e período
CREATE UNIQUE INDEX certificados_um_valido ON certificados (id_usuario, periodo) WHERE situacao = 'valido';
```

| Método | Rota                    | Acesso    | Função                                                                                                                                                                       |
| ------ | ----------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/certificados`         | monitor   | Emite para `{ periodo }`. Recusa período futuro e carga abaixo do mínimo (**422**). Se já houver um válido, ele vira `substituido` e o novo entra na mesma transação (D-C4). |
| GET    | `/certificados`         | monitor   | Lista os próprios, com situação.                                                                                                                                             |
| GET    | `/certificados/:codigo` | só o dono | Dados completos para a página do certificado. Código de outra pessoa responde **404**, igual a inexistente, para não confirmar que existe.                                   |

- A emissão trava a linha do usuário (`SELECT … FOR UPDATE`, como o `bloquearMonitoria` de hoje) e conta com o índice parcial como última barreira contra duas emissões simultâneas.
- O `snapshot` guarda o nome e cada sessão (data, disciplina, minutos). O certificado emitido não muda se o nome mudar, se uma vaga for apagada pela rotina de retenção (R3) ou se a regra mudar depois.
- **Formato do documento (recomendado):** página `certificado.html?c=CODIGO` em A4 com CSS de impressão, e o botão "Imprimir ou salvar em PDF". Não acrescenta dependência nem gera arquivo no servidor, e o mesmo layout serve à tela e ao papel. A alternativa é gerar PDF no backend com `pdfkit`, que fica para depois se a coordenação exigir um arquivo assinado.
- O documento traz o código e o endereço de verificação (`moni-pro.app.br/verificar.html?c=…`). O QR code é opcional e, se entrar, é gerado no navegador com uma biblioteca pequena servida pelo próprio frontend (a CSP não deixa carregar de CDN).
- Quadro "Certificados" do perfil do monitor: barra de progresso até o mínimo, pendências ("2 vagas para finalizar"), botão "Emitir declaração de 2026.2" e a lista. No computador fica na coluna lateral (opção A); no celular, na aba Horas (opção C). Prévia em artefato antes do PR.

PR 4

## Verificação pública

- `GET /certificados/verificar/:codigo`, sem login. Fica dentro do prefixo `/certificados` para não criar outro no Nginx e não colidir com a página `verificar.html`.
- Responde só nome, período, carga horária, data de emissão e situação (válido, substituído ou revogado). Não expõe matrícula, e-mail, id nem a lista de sessões.
- Limite próprio, mais apertado que o geral: 20 consultas por minuto por IP, configurável em `src/config/limites.js` como os outros. `Cache-Control: no-store`, para uma revogação aparecer na hora.
- Código malformado responde **404** antes de ir ao banco (o zod confere o formato base32).
- `verificar.html`: campo do código já preenchido pelo endereço, resultado em destaque e o aviso de que o documento vale com a situação "válido".

PR 5

## Revogação, testes de ponta a ponta e evidências

- `scripts/certificados.js --revogar CODIGO --motivo "…"`, no mesmo estilo do `scripts/retencao.js`: sem `--aplicar`, só mostra o que faria. Grava `revogado_em`, o motivo e uma linha no log (pino).
- Quando o perfil Administrador existir, a revogação passa para o painel e o script fica só como recurso de emergência.
- Casos E2E novos no Playwright (CT-12 e CT-13): o monitor emite e abre o certificado; um visitante sem login verifica o código e vê a situação mudar depois da revogação.
- Evidências em `docs/evidencias/fase04/` (ou a fase em que entrar), sem códigos reais de produção.

## Testes

#### Jest (unidade e rotas)

- Vaga finalizada sem nenhum agendamento concluído não soma horas
- Sessão de 5h conta como 4h
- Sessão das 23h de 30/06 (São Paulo) entra em 2026.1, não em 2026.2
- Vaga e inscrição com horário passado: 400 e 422
- Emitir abaixo do mínimo ou para período futuro: 422
- Aluno tentando emitir: 403
- Abrir o certificado de outro monitor: 404 (IDOR)
- Verificar código inexistente ou malformado: 404
- A verificação não devolve matrícula nem e-mail
- Limite de `/verificar` aplicado

#### Postgres real (`npm run test:int`)

- Duas emissões simultâneas do mesmo período: um válido só, o outro substituído ou recusado
- Reemitir marca o anterior como substituído
- Mudar o nome não altera o certificado já emitido
- Apagar o histórico pela retenção não altera o certificado
- A consulta de horas confere com a soma feita à mão num seed conhecido

#### Playwright

- CT-12: emitir e abrir o certificado (computador e celular)
- CT-13: verificar sem login, antes e depois da revogação

## Riscos residuais (para a seção 25)

| Risco                                                 | Mitigação                                                                        | Residual                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| Monitor e aluno combinam uma sessão que não aconteceu | Dupla confirmação, horário só no futuro (PR 1), teto de 4h, prazo de 7 dias      | Médio até existir o perfil Administrador   |
| Declaração sem valor institucional automático         | Verificação pública por código e situação em tempo real                          | Médio depende de a coordenação aceitar     |
| Enumeração de códigos                                 | 128 bits aleatórios, limite por IP, 404 igual para inexistente e de outra pessoa | Baixo                                      |
| Duas declarações válidas para o mesmo período         | Trava da linha do usuário e índice único parcial                                 | Baixo                                      |
| Dado pessoal exposto na verificação                   | Resposta mínima, sem matrícula nem e-mail                                        | Baixo                                      |
| Revogação sem rastro                                  | Motivo e data gravados, log do script                                            | Médio sem painel e sem tabela de auditoria |

## Decisões do time

Cada uma tem uma recomendação, para o trabalho não parar. O PR 1 e o PR 2 não dependem de nenhuma delas.

| \#       | Pergunta                                                                  | Recomendação                                                                                                                                                                                                                                                                              | Afeta                            |
| -------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **D-C1** | Carga mínima para emitir                                                  | 1h, ajustável por variável de ambiente. A declaração mostra as horas reais, e a coordenação decide se aceita.                                                                                                                                                                             | PR 2                             |
| **D-C2** | O aluno também recebe declaração de participação?                         | Agora não. O RF-005 fala nos dois, mas quem precisa das horas complementares é o monitor. O modelo pode ganhar um campo `tipo` depois, sem mudar o resto.                                                                                                                                 | PR 3                             |
| **D-C3** | Um certificado por semestre ou um por disciplina?                         | Um por semestre, com as horas de cada disciplina discriminadas no documento.                                                                                                                                                                                                              | PR 3                             |
| **D-C4** | O que acontece ao emitir de novo no mesmo semestre, e ao excluir a conta? | Reemitir substitui (a anterior aparece como "substituída" na verificação). Na exclusão da conta, o certificado já emitido mantém o nome e continua verificável, porque o titular pode tê-lo entregado à faculdade (LGPD, art. 7º, VI). O aviso de privacidade ganha uma linha sobre isso. | PR 3, PR 4, aviso de privacidade |
| **D-C5** | Como definir o período?                                                   | Semestre civil (jan–jun e jul–dez). Um calendário acadêmico configurável só se a coordenação pedir.                                                                                                                                                                                       | PR 2                             |

## Atualizações no documento de especificação

- **Seção 7:** RF-005 passa de "planejado" para implementado, com a regra das horas e a queda do número de horas das sessões antigas.
- **RF-005 (tabela de requisitos):** descrição revisada: declaração de horas do monitor, calculada pelas sessões com presença confirmada e verificável por código. A automação "premium" e a assinatura institucional ficam fora.
- **DER (Figura 33):** `Certificado` deixa de ser tracejada, com os campos reais (sai `id_curso` e `id_monitoria` da versão antiga).
- **Seção 24:** matriz de rastreabilidade com os testes de RF-005 e os casos CT-12 e CT-13.
- **Seção 25:** R14 marcado como tratado; riscos novos da tabela acima.
- **Seção 16:** telas novas (quadro de certificados, documento e verificação), capturadas pelo Playwright como as atuais.
- **Histórico de versões** e aviso de privacidade (D-C4).

Plano montado em 11/11/2026 a partir da `develop` (4931ca1), do plano de 14/10 e da v7.2 do documento de especificação.
