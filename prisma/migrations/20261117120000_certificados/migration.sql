-- Certificados (RF-005): declaração de horas do monitor. Tabela nova; nada muda nas existentes.
CREATE TYPE "SituacaoCertificado" AS ENUM ('valido', 'substituido', 'revogado');

CREATE TABLE "certificados" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "carga_minutos" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "situacao" "SituacaoCertificado" NOT NULL DEFAULT 'valido',
    "emitido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogado_em" TIMESTAMP(3),
    "motivo_revogacao" TEXT,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificados_codigo_key" ON "certificados"("codigo");

CREATE INDEX "certificados_id_usuario_periodo_idx" ON "certificados"("id_usuario", "periodo");

ALTER TABLE "certificados" ADD CONSTRAINT "certificados_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Uma única declaração válida por pessoa e semestre (última barreira contra duas emissões
-- simultâneas; o Prisma não descreve índice parcial, por isso fica só aqui)
CREATE UNIQUE INDEX "certificados_um_valido" ON "certificados"("id_usuario", "periodo") WHERE "situacao" = 'valido';
