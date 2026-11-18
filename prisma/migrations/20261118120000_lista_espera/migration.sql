-- Plano 8 (RF-013, RN-015): lista de espera nas vagas lotadas.
-- O valor novo do enum não é usado nesta migração (o Postgres não deixa usar um valor de enum
-- na mesma transação em que ele foi criado).
ALTER TYPE "StatusAgendamento" ADD VALUE 'em_espera';

ALTER TABLE "agendamentos" ADD COLUMN "promovido_em" TIMESTAMP(3);

-- Primeiro da fila de uma vaga: WHERE id_monitoria = ? AND status = 'em_espera' ORDER BY id
CREATE INDEX "agendamentos_id_monitoria_status_id_idx" ON "agendamentos"("id_monitoria", "status", "id");
