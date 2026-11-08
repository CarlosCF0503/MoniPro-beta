-- scripts/limpar-registros-teste.sql
-- Remove de PRODUÇÃO os registros criados pelos casos de teste CT-08 a CT-11 da Fase 02
-- (usuários "[TESTE] ..." / @teste.invalid, as vagas desses monitores e as inscrições ligadas).
--
-- Por padrão só MOSTRA o que seria apagado e desfaz tudo (ROLLBACK).
-- Faça o backup (pg_dump) antes. No servidor, na pasta da produção:
--
--   Simular:  docker-compose exec -T db psql -U monipro -d db_monipro -v ON_ERROR_STOP=1 < scripts/limpar-registros-teste.sql
--   Apagar:   docker-compose exec -T db psql -U monipro -d db_monipro -v ON_ERROR_STOP=1 -v confirmar=1 < scripts/limpar-registros-teste.sql
--
-- Esperado na Fase 02: usuários 25, 26 e 27; 1 vaga; 1 agendamento.

BEGIN;

CREATE TEMP TABLE alvo ON COMMIT DROP AS
    SELECT id FROM usuarios
     WHERE email LIKE '%@teste.invalid' OR nome_completo LIKE '[TESTE]%';

\echo '== Usuários de teste encontrados'
SELECT id, nome_completo, email, tipo_usuario
  FROM usuarios WHERE id IN (SELECT id FROM alvo) ORDER BY id;

\echo '== Agendamentos removidos (do aluno de teste ou em vaga de monitor de teste)'
DELETE FROM agendamentos
 WHERE id_aluno IN (SELECT id FROM alvo)
    OR id_monitoria IN (SELECT id FROM monitorias WHERE id_monitor IN (SELECT id FROM alvo))
RETURNING id, id_monitoria, id_aluno;

\echo '== Vagas removidas'
DELETE FROM monitorias WHERE id_monitor IN (SELECT id FROM alvo)
RETURNING id, id_monitor, id_disciplina, horario;

\echo '== Usuários removidos'
DELETE FROM usuarios WHERE id IN (SELECT id FROM alvo)
RETURNING id, email;

\echo '== Conferência: deve ser 0'
SELECT count(*) AS restantes FROM usuarios
 WHERE email LIKE '%@teste.invalid' OR nome_completo LIKE '[TESTE]%';

\if :{?confirmar}
    COMMIT;
    \echo '>> COMMIT: registros de teste apagados.'
\else
    ROLLBACK;
    \echo '>> ROLLBACK: nada foi apagado. Rode de novo com -v confirmar=1 para apagar.'
\endif
