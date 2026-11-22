-- Índices para as consultas por data que rodam sem filtro de usuário: os lembretes (a cada
-- minuto), o resumo e as faltas do painel da coordenação.
CREATE INDEX "monitorias_horario_idx" ON "monitorias"("horario");
CREATE INDEX "agendamentos_data_hora_idx" ON "agendamentos"("data_hora");
CREATE INDEX "agendamentos_ausente_em_idx" ON "agendamentos"("ausente_em");
