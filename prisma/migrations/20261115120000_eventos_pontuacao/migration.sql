-- Plano 5 (RN-008 revisada, RF-011): extrato de pontos e ranking por disciplina e semestre.
-- Tabela nova. Cada conta com pontos ganha um evento "saldo_inicial" com o valor atual, para a
-- soma dos eventos bater com usuarios.pontos desde o primeiro dia (sem disciplina: não conta no
-- ranking de nenhuma).
CREATE TYPE "TipoEventoPontuacao" AS ENUM ('presenca_aluno', 'sessao_monitor', 'saldo_inicial', 'estorno');

CREATE TABLE "eventos_pontuacao" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" "TipoEventoPontuacao" NOT NULL,
    "pontos" INTEGER NOT NULL,
    "id_disciplina" INTEGER,
    "id_agendamento" INTEGER,
    "periodo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pontuacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "eventos_pontuacao_chave_key" ON "eventos_pontuacao"("chave");

CREATE INDEX "eventos_pontuacao_id_usuario_idx" ON "eventos_pontuacao"("id_usuario");

CREATE INDEX "eventos_pontuacao_id_disciplina_periodo_idx" ON "eventos_pontuacao"("id_disciplina", "periodo");

ALTER TABLE "eventos_pontuacao" ADD CONSTRAINT "eventos_pontuacao_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_pontuacao" ADD CONSTRAINT "eventos_pontuacao_id_disciplina_fkey" FOREIGN KEY ("id_disciplina") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "eventos_pontuacao" ("id_usuario", "tipo", "pontos", "periodo", "chave")
SELECT "id", 'saldo_inicial', "pontos",
       to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY') || '.' ||
       CASE WHEN EXTRACT(MONTH FROM NOW() AT TIME ZONE 'America/Sao_Paulo') <= 6 THEN '1' ELSE '2' END,
       'saldo_inicial:usuario:' || "id"
FROM "usuarios"
WHERE "pontos" <> 0;
