-- Plano 6 (RF-006/007): avaliação da monitoria pelo aluno, moderada pela coordenação
CREATE TABLE "avaliacoes" (
    "id" SERIAL NOT NULL,
    "id_agendamento" INTEGER NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "id_monitor" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" VARCHAR(300),
    "oculto_em" TIMESTAMP(3),
    "id_moderador" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "avaliacoes_nota_check" CHECK ("nota" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "avaliacoes_id_agendamento_key" ON "avaliacoes"("id_agendamento");
CREATE INDEX "avaliacoes_id_monitor_oculto_em_idx" ON "avaliacoes"("id_monitor", "oculto_em");
CREATE INDEX "avaliacoes_criado_em_idx" ON "avaliacoes"("criado_em");
CREATE INDEX "avaliacoes_id_aluno_idx" ON "avaliacoes"("id_aluno");

ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_id_agendamento_fkey" FOREIGN KEY ("id_agendamento") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
