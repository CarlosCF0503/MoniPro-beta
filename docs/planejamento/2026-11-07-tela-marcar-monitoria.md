MoniPro · plano de reescrita do front

# Nova tela Marcar Monitoria

## Situação (registrada em 22/11/2026)

A equipe escolheu o layout de calendário e lista no computador e passo a passo no celular. Implementado na Fase 03 e em produção desde 08/11/2026; os protótipos interativos não foram incluídos nesta cópia.

Reescrever do zero `marcar_monitoria.html`, `JS/marcar_monitoria.js`, `JS/calendario.js` e o CSS da tela, sem mudar o contrato da API. Abaixo: o que está errado hoje, três layouts para testar no protótipo, as opções técnicas e o plano em fases.

6 nov 2026Escopo: front-end estático (Nginx, CSP `script-src 'self'`)Backend: só mudanças opcionaisLayout decidido: calendário + lista no desktop, passo a passo no celular

Andamento · 7 nov 2026

## Onde estamos

| Entrega                                                                                                              | Fases do plano          | Situação                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Nova tela de marcar monitoria e criar vaga** · [PR \#44](https://github.com/CarlosCF0503/MoniPro-beta/pull/44)     | 2, 3, 4, 5 e 7          | Em dev Mergeado no `develop` e publicado em dev.moni-pro.app.br. Falta a conferência manual em dev (CT-08 a CT-11, celular de verdade). |
| **Fonte Inter hospedada no site** · [PR \#45](https://github.com/CarlosCF0503/MoniPro-beta/pull/45)                  | 2 (achado da auditoria) | Em revisão                                                                                                                              |
| **Backend recusa vaga duplicada do monitor (409)** · [PR \#46](https://github.com/CarlosCF0503/MoniPro-beta/pull/46) | 6                       | Em revisão                                                                                                                              |
| Filtro por período em `GET /monitorias` e `ja_inscrito` na listagem                                                  | 6 (opcional)            | Backlog A tela já busca todas as páginas e lê as inscrições do aluno; só vale se o volume crescer.                                      |
| Levar de `develop` para `main`                                                                                       | 7                       | Depois da conferência em dev                                                                                                            |

Diferenças em relação ao plano: o código ficou em scripts clássicos com `defer` em `JS/marcar/`, e não em ES modules, porque o ESLint do front usa `sourceType: 'script'` e o Jest roda em CommonJS. Também não houve a etapa `marcar_monitoria_v2.html`: a tela foi substituída direto, depois que o time validou as réplicas.

Ponto de partida

## O que a tela atual faz mal

Lido do código em `Monipro_web/` e `src/`, somado aos achados da Avaliação UX MoniPro que tocam esta tela. A lógica de negócio do backend (transação com bloqueio da vaga, duplicidade, lotação, RN-001) está sólida; os problemas estão quase todos no front.

Alta

### Layout preso em 540px

`main` é `position: fixed` com altura fixa. Com zoom, tela baixa ou muitas vagas no dia, a lista corta.

CSS/marcar_monitoria.css:7

Alta

### Sem revisão antes de agendar

Um clique em “Agendar” já faz o `POST`, e a página redireciona para `base.html` depois de 2s. O aluno não confere dia, hora e local nem fica sabendo da regra de cancelamento de 24h.

JS/marcar_monitoria.js:273

Alta

### Monitor escolhido não fica destacado

O JS aplica `.monitor-item.selecionado`, mas o CSS só estiliza `.monitor.selecionado`. O aluno clica e nada muda na tela.

JS/marcar_monitoria.js:271 · CSS/marcar_monitoria.css:213

Alta

### Clique duplo pode agendar duas vezes

`salvarAgendamento` não desativa o botão durante o envio, e o estado “Agendado!” põe texto branco sobre `#7CFC00` (contraste ≈1,2:1).

JS/marcar_monitoria.js:281 · CSS/marcar_monitoria.css:270

Alta

### Vagas além de 100 somem

Busca `?limit=100` e filtra no cliente. O backend devolve toda vaga `ativa`, inclusive de horários passados, então as passadas ocupam esse limite.

JS/marcar_monitoria.js:178 · monitoriaRepository.js:20

Média

### Calendário não funciona no teclado

Os dias são `<td>` com `click`: sem foco, sem rótulo para leitor de tela. O estado fica em variáveis globais em `window`.

JS/calendario.js:30

Média

### Aluno não vê que já está inscrito

Só descobre pelo erro “Você já está inscrito nesta monitoria.” depois de tentar.

agendamentoService.js:30

Média

### Monitor não define capacidade

O schema aceita `capacidade` desde a Tarefa 23, mas o formulário não tem o campo; toda vaga nasce com 1 lugar. O monitor também não vê como a vaga vai aparecer para o aluno.

monitoriaSchemas.js:24

Baixa

### “Sugestão recomendada” é a primeira da lista

O card promete uma recomendação, mas escolhe só a primeira vaga com lugar livre.

JS/marcar_monitoria.js:222

Baixa

### HTML montado com estilo inline

Os cards são gerados por `innerHTML` com `style=` embutido. O conteúdo é escapado, mas mistura marcação, estilo e lógica.

JS/marcar_monitoria.js:240

Protótipo interativo · dados de exemplo

## Layout escolhido e alternativas

**Decisão do time:** calendário + lista (A) no desktop e passo a passo (C) no celular, para o aluno e para o monitor. O botão “Escolhido” mostra essa combinação; troque “Perfil” e “Tela” para ver as quatro montagens. No protótipo, o monitor logado é a Ana Ribeiro, então os dias com vagas dela aparecem marcados. A, B e C continuam disponíveis para comparação.

**Réplicas isoladas**, em página inteira com header, menu lateral, janela de sair e toast do sistema, que mudam de montagem pela largura real da janela: Agendar monitoria (aluno) · Criar vaga (monitor).

Troque o layout, o perfil (aluno ou monitor) e o tamanho da tela. O protótipo usa o header, o card principal e os botões da tela atual. Em “Calendário e ícones”, **Novo** mostra o calendário em card com dias arredondados, pontos que indicam a quantidade de horários e um resumo do mês, além de ícones SVG de traço (relógio, local, lugares) e avatar com iniciais no lugar do PNG do monitor; **Atual** volta ao calendário em tabela e ao ícone PNG de hoje. Os dados são fictícios e “hoje” é 6 nov 2026. As duas funções de prévia novas estão aqui: a **revisão antes de confirmar** (aluno) e a **prévia ao vivo da vaga** (monitor), que reaproveita o mesmo card que o aluno vê.

Layout

Perfil

Tela

Calendário e ícones

Cruzamento com a auditoria

## O que a tela nova resolve da Avaliação UX

Achados da Avaliação UX MoniPro (06/11/2026) que caem dentro desta tela, e como o protótipo e o plano tratam cada um.

| Severidade | Achado                                                  | Na tela nova                                                                                                                                       |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crítico    | Monitor selecionado sem destaque                        | O card é um `<button aria-pressed>` com borda de 3px azul-marinho, e o avatar também fica azul-marinho.                                            |
| Crítico    | Dias passados parecem clicáveis                         | Os botões ficam `disabled` e esmaecidos. Sem toast de erro.                                                                                        |
| Crítico    | Quase nada funciona pelo teclado                        | Só botões nativos, sem `div role=button` nem rádios com `display:none`. A navegação do calendário por setas entra na fase 5.                       |
| Crítico    | “Agendado!” ilegível e clique duplo                     | O botão vira “Agendando…” desativado durante o envio. O sucesso usa verde escuro `#1e7b34` com texto branco (≈5,3:1). Experimente no protótipo.    |
| Alto       | Tela com tamanho fixo                                   | Layout em fluxo normal, com colunas via container query. Sem `position:fixed` nem margens negativas.                                               |
| Alto       | Contraste abaixo de 4,5:1 e disponibilidade só pela cor | No visual Novo, nenhum texto branco fica sobre `#4a90e2`. Os fins de semana usam `#64748b` (≈4,8:1) e os dias com horário têm pontos, além da cor. |
| Alto       | Foco não aparece                                        | `:focus-visible` com contorno de 3px em todos os controles.                                                                                        |
| Alto       | Erros somem antes de serem lidos                        | O formulário do monitor mostra o erro junto ao campo. Os erros da API (409, 422) aparecem na revisão, não em toast.                                |
| Médio      | A fonte Inter nunca é carregada                         | Fase 2: hospedar o `.woff2` em `Monipro_web/fonts/`, porque a CSP só aceita `font-src 'self'`.                                                     |
| Médio      | pt-PT misturado com pt-BR                               | Os textos novos estão em pt-BR (“Carregando”, não “A carregar monitores”).                                                                         |
| Médio      | Para onde ir depois de agendar                          | Ainda em aberto, ver as decisões no fim da página.                                                                                                 |
| Baixo      | Estilos inline gerados pelo JS                          | Só classes e o atributo `hidden`. Nenhum `style=` nos componentes.                                                                                 |

Ficam fora desta tela e pertencem à base do sistema: o componente de diálogo e as cores de Sim/Não, a altura `9vh` do header, o menu sem página atual, o campo de busca sem função e o `tokens.css`. A tela nova já nasce usando variáveis CSS, então o `tokens.css` pode sair dela.

Como construir

## Opções de implementação

A restrição que mais pesa é a CSP do Nginx: `script-src 'self'` bloqueia script inline, `eval` e CDN. Qualquer biblioteca precisa ser copiada para dentro de `Monipro_web/JS/`.

[TABLE]

### Estrutura proposta (opção A)

```
Monipro_web/
├─ marcar_monitoria.html        ← reescrito; durante o desenvolvimento: marcar_monitoria_v2.html
├─ CSS/marcar_monitoria.css     ← mobile-first, sem position: fixed; mantém cores e Inter do base.css
└─ JS/marcar/
   ├─ main.js                   boot: lê disciplinaID, decide aluno/monitor, monta a tela
   ├─ estado.js                 getEstado / atualizar / assinar (≈30 linhas)
   ├─ api.js                    listarVagas, agendar, criarVaga (usa chamadaApi global do JS/api.js)
   ├─ datas.js                  funções puras: agrupar por dia, período, prazo de cancelamento
   ├─ datas.test.mjs            node --test, sem dependências
   └─ componentes/
      ├─ seletor-data.js        calendário do mês, navegável por setas (desktop e passo 1 do celular)
      ├─ montagem.js            matchMedia('(min-width: 700px)'): monta lado a lado ou em passos
      ├─ card-vaga.js           um card, usado na lista E na prévia do monitor
      ├─ lista-vagas.js
      ├─ passos.js              indicador de passos + “Trocar dia” (celular)
      ├─ revisao.js             resumo + confirmar + sucesso (agendamento do aluno e vaga do monitor)
      ├─ minhas-vagas.js        “Suas vagas neste dia” do monitor
      └─ form-vaga.js           validação espelhando monitoriaSchemas.js + conflito de horário
```

Execução

## Plano em fases

A versão nova roda ao lado da antiga até a troca, então dá para comparar em homologação sem quebrar o fluxo atual.

1.  ### Decidir layout e abordagem

    **Layout decidido:** calendário + lista no desktop, passo a passo no celular. Falta confirmar a opção técnica e decidir se o card de “sugestão” continua (ver decisões em aberto).

    **Pronto quando:** layout e abordagem anotados no card do Trello.

2.  ### Base nova em `marcar_monitoria_v2.html`
    - HTML semântico: `<main>`, botões reais, `aria-live` na lista.
    - CSS mobile-first reaproveitando o `base.css` (header, menu lateral, toast) e as cores atuais, com as cores em variáveis CSS.
    - Hospedar a Inter em `Monipro_web/fonts/` (`font-src 'self'` bloqueia o Google Fonts) e regra global de `:focus-visible`.
    - Todos os textos em pt-BR.
    - `estado.js`, `datas.js` com testes, `api.js` por cima de `chamadaApi`.
    - Estados de carregando, vazio e erro (hoje um erro 401 aparecia como “nenhum monitor”).

    **Pronto quando:** a v2 lista as vagas reais de uma disciplina em dev.

3.  ### Fluxo do aluno
    - A partir de 700px: calendário à esquerda, lista e revisão à direita. Abaixo disso: passos Dia → Horário → Confirmar, com “Voltar” em cada passo.
    - Um único estado (dia, vaga, etapa) para as duas montagens. Girar o celular ou redimensionar a janela não perde a escolha.
    - Dias passados e sem vaga desabilitados.
    - Card com estado: livre, último lugar, lotada, já inscrito.
    - Revisão antes de confirmar, com o prazo de cancelamento calculado (RN-001, 24h).
    - Botão desativado e com texto “Agendando…” durante o envio, para não criar agendamento duplicado.
    - Sucesso fica na tela com “Ver no meu perfil” e “Agendar outra”, sem redirect automático.
    - Erros da API (409 lotada, 422 já inscrito) voltam para a lista atualizada.

    **Pronto quando:** CT-08 a CT-11 passam na v2 em dev.

4.  ### Fluxo do monitor
    - Mesma decisão do aluno. Desktop: calendário à esquerda (dias com vagas suas marcados) e, à direita, “Suas vagas neste dia”, o formulário e a prévia. Celular: Dia → Detalhes → Revisar.
    - Campos: horário, **lugares** (capacidade), local, assunto.
    - Validação igual ao Zod: local até 120, assunto até 500, capacidade inteira ≥ 1, horário no futuro. Mais um aviso de conflito: “Você já tem uma vaga às 14:00 neste dia.”
    - Prévia ao vivo usando `card-vaga.js`, e revisão antes de criar, com o aviso de cancelamento de 24h.
    - “Criar vaga” desativado durante o envio; depois do sucesso, a vaga nova já aparece em “Suas vagas neste dia”.

    **Pronto quando:** uma vaga com capacidade 3 é criada e aparece certa para um aluno.

5.  ### Acessibilidade e responsivo
    - Calendário navegável por setas, Home/End, Enter.
    - Foco vai para a revisão ao abrir e volta à lista ao cancelar.
    - Conferir em 360px, 768px e 1280px, e com zoom de 200%.

    **Pronto quando:** o fluxo completo funciona só com teclado.

6.  ### Ajustes opcionais no backend
    - `GET /monitorias/:idDisciplina?de=&ate=` para buscar só o mês ou a semana visível.
    - Excluir vagas com `horario < agora` da listagem.
    - Incluir `ja_inscrito` por vaga para o aluno autenticado.
    - Derivar `data_hora` do agendamento da própria vaga em vez de receber do cliente.
    - Recusar com 409 uma vaga do mesmo monitor no mesmo horário. Hoje só o front avisa o conflito.

    **Pronto quando:** testes Jest de monitoria e agendamento cobrem os filtros novos. Sem isso, a tela funciona com a API atual.

7.  ### Troca e limpeza
    - Apontar o link em `JS/escolha_disciplina.js:27` para a v2, validar em homologação, depois renomear para `marcar_monitoria.html`.
    - Apagar `JS/calendario.js` e o `JS/marcar_monitoria.js` antigo (hoje só esta tela usa o calendário).

    **Pronto quando:** não sobra referência aos arquivos antigos e o deploy de produção passou.

Para fechar antes da fase 2

## Decisões em aberto

### Layout Decidido

Calendário + lista no desktop, passo a passo no celular. Ponto de troca proposto: 700px de largura.

### Manter a “sugestão”?

Remover, ou trocar por uma regra explícita, como “próximo horário com lugar” e o rótulo dizendo isso.

### Backend agora ou depois?

A fase 6 resolve o limite de 100 vagas e o “já inscrito”. Sem ela, a tela nova herda essas duas limitações.

### Depois de agendar

Ficar na tela com atalhos (protótipo) ou ir direto para o perfil, onde o agendamento aparece, como sugere a auditoria. As duas opções são melhores do que o redirect atual para `base.html` depois de 2s.
