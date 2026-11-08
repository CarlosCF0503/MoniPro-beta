-- P3 (R7): versão da sessão, levada no JWT. O "sair" incrementa e invalida os tokens antigos.
ALTER TABLE "usuarios" ADD COLUMN     "versao_token" INTEGER NOT NULL DEFAULT 0;
