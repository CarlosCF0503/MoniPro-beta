-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('aluno', 'monitor');

-- CreateEnum
CREATE TYPE "StatusMonitoria" AS ENUM ('ativa', 'pendente', 'realizada', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('pendente', 'confirmado', 'cancelado');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "tipo_usuario" "TipoUsuario" NOT NULL,
    "matricula" INTEGER NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitorias" (
    "id" SERIAL NOT NULL,
    "horario" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "local" TEXT NOT NULL,
    "status" "StatusMonitoria" NOT NULL DEFAULT 'ativa',
    "id_monitor" INTEGER NOT NULL,
    "id_disciplina" INTEGER NOT NULL,

    CONSTRAINT "monitorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" SERIAL NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'pendente',
    "id_monitoria" INTEGER NOT NULL,
    "id_aluno" INTEGER NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_matricula_key" ON "usuarios"("matricula");

-- AddForeignKey
ALTER TABLE "monitorias" ADD CONSTRAINT "monitorias_id_monitor_fkey" FOREIGN KEY ("id_monitor") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitorias" ADD CONSTRAINT "monitorias_id_disciplina_fkey" FOREIGN KEY ("id_disciplina") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_id_monitoria_fkey" FOREIGN KEY ("id_monitoria") REFERENCES "monitorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_id_aluno_fkey" FOREIGN KEY ("id_aluno") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
