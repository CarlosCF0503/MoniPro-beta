-- Plano 9 (RF-014): vagas recorrentes. As vagas criadas juntas, toda semana, compartilham o
-- id_serie; cada uma continua independente (editar e cancelar uma por uma).
ALTER TABLE "monitorias" ADD COLUMN "id_serie" TEXT;

CREATE INDEX "monitorias_id_serie_idx" ON "monitorias"("id_serie");
