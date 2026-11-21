-- Plano 7: a coordenação assina o certificado pelo painel (o nome fica guardado como estava)
ALTER TABLE "certificados" ADD COLUMN "assinado_em" TIMESTAMP(3),
ADD COLUMN "id_assinante" INTEGER,
ADD COLUMN "assinante_nome" TEXT;

CREATE INDEX "certificados_situacao_assinado_em_idx" ON "certificados"("situacao", "assinado_em");
