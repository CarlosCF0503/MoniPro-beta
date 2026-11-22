Plano de redesenho · Front-end

# Nova tela de Perfil do Monitor

## Situação (registrada em 22/11/2026)

A equipe escolheu o layout em abas no computador e abas no rodapé no celular. Implementado na Fase 03 (PRs #51 e #57) e em produção desde 08/11/2026; os protótipos interativos não foram incluídos nesta cópia.

A tela atual mistura vagas futuras, vagas já passadas e canceladas numa lista só, mostra um saldo de pontos fixo e esconde os certificados atrás de um botão "Ver". A proposta reorganiza a tela em torno da pergunta que o monitor tem ao abrir o perfil: **o que preciso fazer agora?**

07/11/2026 Tela: `Monipro_web/perfil_monitor.html` Esforço estimado: 3 a 4 dias Só tema claro, como o sistema

1 · Diagnóstico

## O que está errado na tela atual

Levantado lendo `perfil_monitor.html`, `CSS/perfil_monitor.css`, `JS/perfil.js` e a rota `GET /perfil/monitorias`.

Alta · bug

### Pontos fixos em "15"

O JS escreve em `#pontosUsuario`, mas o HTML do monitor tem só `<strong>15</strong>` sem id. Todo monitor vê 15 pontos.

perfil_monitor.html:354 · perfil.js:66

Alta · acessibilidade

### Status só por cor, com contraste baixo

"PENDENTE" em `#ffa500` sobre `#f8fafc` dá cerca de 2:1, abaixo dos 4,5:1 da WCAG AA. O status também não tem ícone nem fundo.

perfil_monitor.css:214-233

Alta · dados

### Só as 20 vagas mais distantes aparecem

A API pagina com limite 20 e ordena por `horario desc`. O front não pede a próxima página, então vagas antigas somem sem aviso e as próximas ficam no fim.

utils/paginacao.js:2 · monitoriaRepository.js:126

Média · fluxo

### Nada diz o que exige ação

Uma vaga cujo horário já passou e ainda está "ativa" aparece igual a uma vaga da semana que vem. O botão "Finalizar" aparece até em vagas futuras.

perfil.js:224-249

Média · informação

### Sem número de inscritos

O monitor não sabe se a vaga tem alunos, se está lotada ou vazia. A API não devolve a contagem de inscrições.

monitoriaRepository.js:117-130

Média · identidade

### Fundo cinza-esverdeado fora do padrão

`body{background:#f4f7f6}` substitui o gradiente azul `#ACC8FF → branco` que o resto do sistema usa.

perfil_monitor.css:3-6

Média · acessibilidade

### Modais sem semântica de diálogo

O modal de certificados não tem `role="dialog"`, não prende o foco e não fecha com Esc. O botão "Ver" vira "Fechar" fora do modal.

perfil_monitor.html:448 · perfil.js:121-136

Baixa · polimento

### Status repetido e estados crus

Vagas encerradas mostram o status duas vezes. Carregando, vazio e erro são parágrafos soltos, com cor inline e sem botão para tentar de novo nem para abrir uma vaga.

perfil.js:249-266

2 · Prévia interativa

## Como a nova tela fica

Clique nas abas, em **Finalizar** e em **Cancelar vaga**: os diálogos, a validação e as contagens funcionam. Os nomes, datas e números são **dados de exemplo**, com "hoje" em 07/11/2026.

Layout

Tela

Estado

Certificados

Os três layouts usam os mesmos dados, os mesmos diálogos e as mesmas cores. Mude "Tela" para ver como cada um se reorganiza no celular. Em todos, os botões têm 44px de altura.

2b · Comparação dos layouts

## Qual layout escolher

| Opção | No computador                                                    | No celular                                                                                                                                                                                     | Ponto forte no celular                                                           | Ponto fraco no celular                                                                    |
| ----- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A     | Abas e coluna lateral com dados e certificados.                  | **Lista com filtro.** Linha de perfil compacta, filtro de 3 segmentos fixo no topo, lista em linhas e botão + flutuante. Dados e certificados ficam no painel "Perfil".                        | Tela mais limpa: só uma lista. O filtro fica sempre ao alcance.                  | Certificados e horas ficam a um toque de distância, dentro do painel de perfil.           |
| B     | Faixa de perfil, seção "Precisa de você" e histórico na lateral. | **Resumo do dia.** Saudação com resumo em uma linha, uma única vaga em destaque para finalizar, agenda agrupada por dia, atalhos para histórico, certificados e dados, e botão fixo no rodapé. | A ação mais importante abre a tela, e o botão principal fica na zona do polegar. | Com muitas vagas futuras, a agenda fica longa e os atalhos descem.                        |
| C     | Quadro com três colunas.                                         | **Abas no rodapé.** Três telas separadas (Vagas, Horas, Perfil), cada uma com um único assunto e um selo laranja com o número de vagas para finalizar.                                         | Horas por disciplina ganham uma tela própria. Navegação no padrão de aplicativo. | A barra de abas convive com o menu lateral do sistema: são duas navegações na mesma tela. |

**Regras dos três layouts de celular:**

- Linhas separadas por uma divisória fina, em vez de cartões com borda e sombra. Só o destaque de "Precisa de você" tem fundo.
- Cada linha mostra só data ou hora, disciplina e uma linha de apoio. Local, inscritos e ações completas ficam no painel de detalhes.
- Textos longos terminam em reticências, sem quebrar a linha.
- Uma ação principal por tela, perto do polegar: botão flutuante, barra fixa ou botão no topo da lista.
- Detalhes, finalizar e cancelar abrem em painéis que sobem do rodapé, fecham com toque fora ou com Esc, e têm botões com largura total.
- Laranja só para o que pede ação. O resto fica em azul-marinho e cinza.

**Decisão (07/11/2026):** **Opção A no computador e Opção C no celular.** A prévia abre nessa combinação ("Decidida · A + C"), que troca sozinha conforme a largura. As duas montagens usam os mesmos dados, diálogos e componentes; só a marcação muda no ponto de quebra. Isso soma cerca de 1 dia ao passo 3 do plano.

As opções A, B e C continuam na prévia só para comparação.

##

##

3 · Decisões de UX

## Por que cada parte está onde está

| Decisão                                                                           | Motivo                                                                                                                                                                                                                            | Resolve                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Aba "Para finalizar" primeiro, aberta por padrão quando tem itens                 | É a única lista que pede ação. Vaga passada sem finalização não gera horas nem certificado.                                                                                                                                       | Nada diz o que exige ação        |
| Três abas: Para finalizar, Próximas, Histórico                                    | Separa o que o monitor faz, o que vem e o que já passou. Próximas em ordem crescente, histórico em decrescente.                                                                                                                   | Lista única misturada            |
| "Finalizar" só depois do horário de início                                        | Evita finalizar vaga que nem começou. Bate com a regra da Etapa 0 do plano de certificados.                                                                                                                                       | Botão em vaga futura             |
| Resumo com 3 números no topo                                                      | Próximas, para finalizar e horas comprovadas. O número de "para finalizar" fica em destaque laranja.                                                                                                                              | Falta de visão geral             |
| Bloco de data + pill de status com ícone e texto                                  | A data é o que o monitor procura primeiro. Status legível sem depender só da cor, com contraste acima de 4,5:1.                                                                                                                   | Contraste e cor como único sinal |
| "1 de 3 inscritos" com barra curta                                                | Mostra se vale manter a vaga. O aviso de cancelamento diz quantos alunos perdem a vaga.                                                                                                                                           | Sem número de inscritos          |
| Certificados como seção fixa, não modal                                           | Fica visível sem clique. O estado vazio explica como se ganha um certificado.                                                                                                                                                     | Certificados escondidos          |
| `<dialog>` nativo nos diálogos                                                    | O navegador prende o foco, fecha com Esc e devolve o foco ao botão que abriu.                                                                                                                                                     | Modais sem semântica             |
| Término numa caixa de horário clicável, com lista curta, e atalhos 1h / 1h30 / 2h | Mesmo componente de Marcar Monitoria: a caixa inteira abre a lista, não só o ícone do relógio. A lista mostra cerca de 7 horários, de 15 em 15 minutos, com a duração ao lado, e rola por dentro sem esticar até o fim da página. | Campo datetime-local trabalhoso  |
| "Cancelar vaga" só quando o backend aceita (RN-001)                               | Vaga em "Para finalizar" não tem cancelar, só finalizar. Vaga que começa em menos de 24h mostra "Cancelamento só até 24h antes" no lugar do botão, em vez de deixar o monitor tentar e receber erro.                              | Ação que sempre falharia         |
| Ação destrutiva como botão de texto vermelho                                      | "Cancelar vaga" não compete com "Finalizar". A confirmação usa verbos: "Manter vaga" e "Cancelar vaga".                                                                                                                           | Botões com o mesmo peso          |
| Esqueleto, vazio com CTA e erro com "Tentar de novo"                              | Cada estado diz o que acontece e qual é o próximo passo.                                                                                                                                                                          | Estados crus                     |

4 · Plano de implementação

## Passos, em ordem

O passo 1 entra sozinho, num PR pequeno, porque corrige bugs que os usuários já veem. Os passos 2 a 4 podem ir num PR só, atrás da mesma URL.

1.  1

    ### Correções imediatas na tela atual meio dia
    - Trocar `<strong>15</strong>` por `<strong id="pontosUsuario">0</strong>`.
    - Remover o status duplicado das vagas encerradas.
    - Escurecer as cores de status para passar de 4,5:1 (laranja `#8a5300`, verde `#1e7b34`).

    perfil_monitor.html · CSS/perfil_monitor.css · JS/perfil.js

2.  2

    ### API: contagem de inscritos e lista completa meio dia
    - Incluir `_count` das inscrições não canceladas em `buscarPorMonitor` (mesmo critério de `vagas_disponiveis`) e devolver como `inscritos`. `capacidade` já vem no retorno.
    - O front pede `?limit=100` e mostra "Ver mais" quando `paginacao` indica outra página.
    - Atualizar `tests/perfil.test.js` para cobrir `_count` e o limite.

    ```

    ```

// src/repositories/monitoriaRepository.js · buscarPorMonitor
include: {
disciplina: { select: { nome: true } },
_count: {
select: {
inscricoes: { where: { status: { not: 'cancelado' } } }
}
}
},
// perfilService.obterMonitorias: troca _count por { inscritos: N }

```

    src/repositories/monitoriaRepository.js · tests/perfil.test.js

3.  3

    ### Nova marcação e CSS 1 dia

    - Reescrever o `<main>` de `perfil_monitor.html` com a estrutura da prévia. Header, menu lateral e modal de sair ficam como estão.
    - Trocar os modais de finalizar, confirmar e certificados por `<dialog>`.
    - No término, reaproveitar a caixa de horário de Marcar Monitoria (`campoHora` em `JS/marcar/componentes.js` e `.hora-btn`/`.hora-lista` em `marcar_monitoria.css`), com opções relativas ao início: de 15 em 15 minutos até 4h.
    - Abrir `perfil_monitor.css` com variáveis CSS no `:root` usando as cores de `base.css`. Remover o fundo `#f4f7f6`.
    - Ponto de quebra em 760px: uma coluna, botões com largura total e alvos de 44px.

    perfil_monitor.html · CSS/perfil_monitor.css

4.  4

    ### JS do monitor separado 1 a 1,5 dia

    - Criar `JS/perfil/monitor.js`, no mesmo padrão de `JS/marcar/`. `perfil.js` fica só com a parte comum e a do aluno.
    - Classificar no cliente: *para finalizar* = ativa ou pendente com horário passado; *próximas* = ativa ou pendente com horário futuro; *histórico* = o resto.
    - Horas comprovadas = soma de `data_fim − horario` das vagas realizadas, até a Etapa 0 trazer `duracao_minutos`.
    - Após finalizar ou cancelar, mover o item de aba e atualizar contagens sem recarregar a página. Manter `escaparHtml` em todo texto vindo da API.

    JS/perfil/monitor.js (novo) · JS/perfil.js

5.  5

    ### Validação meio dia

    - Testar em 360px, 768px e 1280px, com teclado apenas (Tab, Enter, Esc).
    - Rodar Lighthouse em acessibilidade, com meta de 95 ou mais.
    - Testar com conta de monitor sem vagas, com mais de 20 vagas e com a API fora do ar.

    relatorios/ (evidências)

5 · Critérios de aceite

## A tela está pronta quando

- Os pontos exibidos são os de `GET /perfil`, não um valor fixo.
- Vaga com horário passado e status ativa aparece em "Para finalizar" e em nenhuma outra aba.
- Vaga futura não mostra o botão "Finalizar".
- Cada vaga mostra inscritos e capacidade.
- Monitor com mais de 20 vagas vê todas, com "Ver mais".
- Todo texto e status tem contraste de 4,5:1 ou mais.
- Diálogos abrem com foco no primeiro campo, fecham com Esc e devolvem o foco.
- Sem rolagem horizontal em 360px. Alvos de toque com 44px ou mais.
- Carregando, vazio e erro têm tela própria, e o erro oferece "Tentar de novo".
- O fundo e as cores seguem `base.css`.

6 · Fora do escopo

## O que este plano não faz

**Emissão de certificados.** A seção já existe na tela, mas a lista só se preenche quando a Etapa C do plano de certificados e gamificação estiver pronta. Até lá, aparece o estado vazio.

**Editar perfil e foto.** Não existe endpoint para isso. O avatar usa as iniciais do nome.

**Marcar presença por aluno.** Depende do endpoint `PATCH /monitorias/:id/presencas` da Etapa 0. Quando ele existir, o diálogo de finalizar ganha a lista de inscritos com caixas de presença.

Gerado a partir do código em `MoniPro-beta-main/` em 07/11/2026. Os dados da prévia são fictícios.
```
