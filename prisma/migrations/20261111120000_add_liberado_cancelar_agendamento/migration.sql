-- Editar vaga (RN-010, ajuste da RN-001): quando a vaga muda de dia, horário ou local, os
-- inscritos podem cancelar sem a antecedência de 24h. Campo opcional, sem default.
ALTER TABLE "agendamentos" ADD COLUMN     "liberado_cancelar_em" TIMESTAMP(3);
