-- RF-008 / RN-009 (recuperar senha): tokens do link de redefinição, guardados só como hash.
-- Tabela nova; nada muda nas existentes.
CREATE TABLE "tokens_redefinicao" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_redefinicao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_redefinicao_hash_key" ON "tokens_redefinicao"("hash");

CREATE INDEX "tokens_redefinicao_id_usuario_idx" ON "tokens_redefinicao"("id_usuario");

ALTER TABLE "tokens_redefinicao" ADD CONSTRAINT "tokens_redefinicao_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
