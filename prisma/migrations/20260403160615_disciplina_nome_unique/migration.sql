/*
  Warnings:

  - A unique constraint covering the columns `[nome]` on the table `disciplinas` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,tipo_usuario]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[matricula,tipo_usuario]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "usuarios_email_key";

-- DropIndex
DROP INDEX "usuarios_matricula_key";

-- CreateIndex
CREATE UNIQUE INDEX "disciplinas_nome_key" ON "disciplinas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_tipo_usuario_key" ON "usuarios"("email", "tipo_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_matricula_tipo_usuario_key" ON "usuarios"("matricula", "tipo_usuario");
