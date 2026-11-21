-- Plano 7: disciplina criada por monitor fica pendente até a coordenação revisar.
-- As disciplinas que já existem continuam aprovadas (default).
CREATE TYPE "StatusDisciplina" AS ENUM ('pendente', 'aprovada');

ALTER TABLE "disciplinas" ADD COLUMN "status" "StatusDisciplina" NOT NULL DEFAULT 'aprovada',
ADD COLUMN "id_criador" INTEGER,
ADD COLUMN "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "disciplinas_status_idx" ON "disciplinas"("status");
