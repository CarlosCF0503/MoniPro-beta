-- Plano 7 (RF-012, RN-014): perfil de coordenação e registro das ações do painel
ALTER TYPE "TipoUsuario" ADD VALUE 'coordenador';

CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "acao" VARCHAR(40) NOT NULL,
    "alvo" VARCHAR(60) NOT NULL,
    "descricao" VARCHAR(300) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_criado_em_idx" ON "auditoria"("criado_em");

ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
