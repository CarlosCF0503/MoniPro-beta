# Evidências do R3: Aviso de Privacidade e prazo de retenção (LGPD), 09/11/2026

O orientador recomendou publicar um aviso de privacidade e definir o prazo de retenção dos dados, para completar o tratamento da LGPD.

## Índice

| Arquivo | O que comprova |
|---|---|
| `hml-aviso-e-exclusao.txt` | Na hml, o aviso é público (200), com as 7 seções; o link aparece no login, na escolha de perfil, no cadastro (com a frase de ciência), nas páginas internas e nos perfis. A exclusão de conta responde 401 sem sessão, 400 com senha errada (a conta continua) e 403 vinda de outro site. A migração `20261109120000_lgpd_retencao` está aplicada |
| `banco-real-exclusao-e-retencao.txt` | Contra um PostgreSQL real, 20 verificações. O login registra o último acesso. A exclusão anonimiza a conta, cancela as inscrições e vagas futuras, mantém o histórico passado e revoga a sessão; o mesmo e-mail pode criar conta nova depois. O `scripts/retencao.js` só conta na simulação e, com `--aplicar`, anonimiza só a conta parada há mais de 12 meses e apaga só o histórico com mais de 2 anos |
| `telas-navegador.txt` | 57 verificações no navegador, em três tamanhos (computador, celular e 360 px): links, frase de ciência, botão e diálogo de exclusão, foco, mensagens de erro, volta ao login, cookie apagado e conta excluída sem conseguir entrar. Sem rolagem lateral nem erros no console |
| `capturas/` | Telas do aviso, do login, do cadastro, dos perfis e do diálogo de exclusão, no computador e no celular |

## Prazos aplicados (proposta da decisão D4)

| Dado | Prazo | O que acontece depois |
|---|---|---|
| Conta sem nenhum login | 12 meses | Anonimizada (nome, e-mail, matrícula e senha apagados) |
| Inscrições e vagas | 2 anos | Apagadas; os pontos ficam na conta |
| Registros dos containers | Rotação | Até 5 arquivos de 10 MB por serviço |

## Pendências

- **Decisão D4:** o aviso publica o contato do responsável como "[contato a definir pela equipe]". O time e o orientador ainda vão definir quem consta como controlador e qual canal publicar, e o texto será revisto depois.
- O `scripts/retencao.js --aplicar` ainda não foi agendado no servidor.
- Em 09/11, R3 estava na develop e na hml, mas ainda não em produção.

## Telas

Antes do código, as telas foram validadas pelo time em prévias montadas dos arquivos reais.

## PR

#67

## O que foi ocultado

A senha e o token da conta de teste da hml. As contas criadas na hora usam `@e2e.invalid` e `@r3.invalid`.
