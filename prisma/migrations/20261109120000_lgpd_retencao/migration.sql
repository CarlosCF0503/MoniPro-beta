-- R3 (LGPD): último acesso (prazo de retenção) e data da anonimização da conta.
-- As contas que já existem começam a contar o prazo a partir desta migração.
ALTER TABLE "usuarios" ADD COLUMN "ultimo_acesso" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "usuarios" ADD COLUMN "anonimizado_em" TIMESTAMP(3);
