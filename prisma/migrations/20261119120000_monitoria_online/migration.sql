-- Plano 11 (RF-016): monitoria on-line. As vagas atuais ficam presenciais.
CREATE TYPE "Modalidade" AS ENUM ('presencial', 'online');

ALTER TABLE "monitorias" ADD COLUMN "modalidade" "Modalidade" NOT NULL DEFAULT 'presencial',
ADD COLUMN "link" TEXT;
