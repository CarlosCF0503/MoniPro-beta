-- Plano 14 (RF-018, RN-017): confirmar o e-mail no cadastro.
-- Duas colunas novas em usuarios e uma tabela nova. As contas que já existem entram como
-- confirmadas (decisão do time), para ninguém ficar sem conseguir entrar.
ALTER TABLE "usuarios" ADD COLUMN "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "email_confirmado_em" TIMESTAMP(3);

UPDATE "usuarios" SET "email_confirmado_em" = CURRENT_TIMESTAMP;

CREATE TABLE "tokens_confirmacao_email" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_confirmacao_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_confirmacao_email_hash_key" ON "tokens_confirmacao_email"("hash");

CREATE INDEX "tokens_confirmacao_email_id_usuario_idx" ON "tokens_confirmacao_email"("id_usuario");

ALTER TABLE "tokens_confirmacao_email" ADD CONSTRAINT "tokens_confirmacao_email_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
