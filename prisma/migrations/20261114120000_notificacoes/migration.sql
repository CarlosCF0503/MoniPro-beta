-- Plano 3 (RF-010, RN-011): fila de e-mails de aviso. Tabela nova; nada muda nas existentes.
CREATE TYPE "StatusNotificacao" AS ENUM ('pendente', 'enviada', 'falhou');

CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "modelo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "chave" TEXT NOT NULL,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimo_erro" TEXT,
    "enviar_apos" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notificacoes_chave_key" ON "notificacoes"("chave");

CREATE INDEX "notificacoes_status_enviar_apos_idx" ON "notificacoes"("status", "enviar_apos");

CREATE INDEX "notificacoes_id_usuario_idx" ON "notificacoes"("id_usuario");

ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
