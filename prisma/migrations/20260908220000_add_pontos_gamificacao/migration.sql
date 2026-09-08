-- AlterEnum
ALTER TYPE "StatusAgendamento" ADD VALUE IF NOT EXISTS 'concluido';

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "pontos" INTEGER NOT NULL DEFAULT 0;
