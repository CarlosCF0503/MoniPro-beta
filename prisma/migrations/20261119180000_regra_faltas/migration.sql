-- Plano 12 (RN-016): ausência marcada pelo monitor e o índice para contar as faltas recentes
ALTER TABLE "agendamentos" ADD COLUMN "ausente_em" TIMESTAMP(3);

CREATE INDEX "agendamentos_id_aluno_ausente_em_idx" ON "agendamentos"("id_aluno", "ausente_em");
