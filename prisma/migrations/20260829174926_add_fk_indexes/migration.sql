-- CreateIndex
CREATE INDEX "monitorias_id_monitor_idx" ON "monitorias"("id_monitor");

-- CreateIndex
CREATE INDEX "monitorias_id_disciplina_idx" ON "monitorias"("id_disciplina");

-- CreateIndex
CREATE INDEX "agendamentos_id_monitoria_idx" ON "agendamentos"("id_monitoria");

-- CreateIndex
CREATE INDEX "agendamentos_id_aluno_idx" ON "agendamentos"("id_aluno");
