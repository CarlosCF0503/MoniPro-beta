-- P2 (R4): confirmação de presença dos dois lados (aluno e monitor)
ALTER TABLE "agendamentos" ADD COLUMN     "presenca_aluno_em" TIMESTAMP(3),
ADD COLUMN     "presenca_monitor_em" TIMESTAMP(3);
