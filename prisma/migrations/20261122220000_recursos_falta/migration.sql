-- Plano 7: pedido de revisão da falta com comprovante (atestado), analisado pela coordenação
CREATE TYPE "StatusRecurso" AS ENUM ('pendente', 'aceito', 'recusado');

CREATE TABLE "recursos_falta" (
    "id" SERIAL NOT NULL,
    "id_agendamento" INTEGER NOT NULL,
    "id_aluno" INTEGER NOT NULL,
    "justificativa" VARCHAR(500) NOT NULL,
    "arquivo_nome" VARCHAR(120) NOT NULL,
    "arquivo_tipo" VARCHAR(30) NOT NULL,
    "arquivo_tamanho" INTEGER NOT NULL,
    "arquivo" BYTEA NOT NULL,
    "status" "StatusRecurso" NOT NULL DEFAULT 'pendente',
    "motivo_decisao" VARCHAR(300),
    "id_decisor" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidido_em" TIMESTAMP(3),

    CONSTRAINT "recursos_falta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recursos_falta_id_agendamento_key" ON "recursos_falta"("id_agendamento");
CREATE INDEX "recursos_falta_status_idx" ON "recursos_falta"("status");
CREATE INDEX "recursos_falta_id_aluno_idx" ON "recursos_falta"("id_aluno");
CREATE INDEX "recursos_falta_criado_em_idx" ON "recursos_falta"("criado_em");

ALTER TABLE "recursos_falta" ADD CONSTRAINT "recursos_falta_id_agendamento_fkey" FOREIGN KEY ("id_agendamento") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
