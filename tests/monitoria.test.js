const request = require("supertest");
const { gerarToken } = require("./helpers/token");

jest.mock("../src/config/bancoDeDados", () => ({
  usuario: {},
  monitoria: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  agendamento: { findMany: jest.fn(), count: jest.fn() },
}));

const prisma = require("../src/config/bancoDeDados");
const app = require("../src/app");

const tokenMonitor = gerarToken({ id: 10, tipo: "monitor" });
const tokenAluno = gerarToken({ id: 20, tipo: "aluno" });

const dadosVaga = {
  id_disciplina: 1,
  horario: "2026-09-10T14:00:00.000Z",
  local: "Sala 12",
};

describe("POST /monitorias (Tarefa 21 — controle de acesso na criação de vagas)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 201 quando o token é de um monitor", async () => {
    prisma.monitoria.create.mockResolvedValue({
      id: 1,
      ...dadosVaga,
      id_monitor: 10,
    });

    const resposta = await request(app)
      .post("/monitorias")
      .set("Authorization", `Bearer ${tokenMonitor}`)
      .send(dadosVaga);

    expect(resposta.status).toBe(201);
    expect(prisma.monitoria.create).toHaveBeenCalledTimes(1);
  });

  it("repassa capacidade informada ao criar a vaga (Tarefa 23)", async () => {
    prisma.monitoria.create.mockResolvedValue({
      id: 1,
      ...dadosVaga,
      capacidade: 5,
    });

    const resposta = await request(app)
      .post("/monitorias")
      .set("Authorization", `Bearer ${tokenMonitor}`)
      .send({ ...dadosVaga, capacidade: 5 });

    expect(resposta.status).toBe(201);
    expect(prisma.monitoria.create.mock.calls[0][0].data.capacidade).toBe(5);
  });

  it.each([0, -1, 2.5, "3"])(
    "retorna 400 para capacidade inválida (%p)",
    async (capacidade) => {
      const resposta = await request(app)
        .post("/monitorias")
        .set("Authorization", `Bearer ${tokenMonitor}`)
        .send({ ...dadosVaga, capacidade });

      expect(resposta.status).toBe(400);
      expect(prisma.monitoria.create).not.toHaveBeenCalled();
    },
  );

  it("retorna 403 quando o token é de um aluno (isMonitor deve bloquear)", async () => {
    const resposta = await request(app)
      .post("/monitorias")
      .set("Authorization", `Bearer ${tokenAluno}`)
      .send(dadosVaga);

    expect(resposta.status).toBe(403);
    expect(prisma.monitoria.create).not.toHaveBeenCalled();
  });

  it("retorna 401 quando não há token", async () => {
    const resposta = await request(app).post("/monitorias").send(dadosVaga);

    expect(resposta.status).toBe(401);
    expect(prisma.monitoria.create).not.toHaveBeenCalled();
  });
});

describe("GET /monitorias/:idDisciplina (Tarefa 22 — exigir autenticação na listagem)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 quando a requisição não está autenticada", async () => {
    const resposta = await request(app).get("/monitorias/1");

    expect(resposta.status).toBe(401);
    expect(prisma.monitoria.findMany).not.toHaveBeenCalled();
  });

  it("retorna 200 e a lista quando a requisição está autenticada", async () => {
    prisma.monitoria.findMany.mockResolvedValue([
      { id: 1, local: "Sala 12", capacidade: 1, _count: { inscricoes: 0 } },
    ]);
    prisma.monitoria.count.mockResolvedValue(1);

    const resposta = await request(app)
      .get("/monitorias/1")
      .set("Authorization", `Bearer ${tokenAluno}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.monitorias).toHaveLength(1);
  });

  it("expõe vagas_disponiveis = capacidade - inscrições ativas, sem vazar _count (Tarefa 23)", async () => {
    prisma.monitoria.findMany.mockResolvedValue([
      { id: 1, local: "Sala 12", capacidade: 3, _count: { inscricoes: 1 } },
      { id: 2, local: "Sala 13", capacidade: 1, _count: { inscricoes: 1 } },
      { id: 3, local: "Sala 14", capacidade: 2, _count: { inscricoes: 5 } }, // legado/excesso
    ]);
    prisma.monitoria.count.mockResolvedValue(3);

    const resposta = await request(app)
      .get("/monitorias/1")
      .set("Authorization", `Bearer ${tokenAluno}`);

    const vagas = resposta.body.monitorias.map((m) => m.vagas_disponiveis);
    expect(vagas).toEqual([2, 0, 0]);
    expect(resposta.body.monitorias[0].capacidade).toBe(3);
    expect(resposta.body.monitorias[0]).not.toHaveProperty("_count");
  });

  it("pede ao Prisma a contagem apenas de inscrições não canceladas", async () => {
    prisma.monitoria.findMany.mockResolvedValue([]);
    prisma.monitoria.count.mockResolvedValue(0);

    await request(app)
      .get("/monitorias/1")
      .set("Authorization", `Bearer ${tokenAluno}`);

    const { include } = prisma.monitoria.findMany.mock.calls[0][0];
    expect(include._count.select.inscricoes.where).toEqual({
      status: { not: "cancelado" },
    });
  });
});

describe("PUT /monitorias/:id/cancelar", () => {
  beforeEach(() => jest.clearAllMocks());

  const em48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const em10h = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

  it("retorna 200 quando o monitor dono da vaga cancela", async () => {
    prisma.monitoria.findUnique.mockResolvedValue({
      id: 1,
      id_monitor: 10,
      status: "ativa",
      horario: em48h,
    });
    prisma.monitoria.update.mockResolvedValue({
      id: 1,
      id_monitor: 10,
      status: "cancelada",
    });

    const resposta = await request(app)
      .put("/monitorias/1/cancelar")
      .set("Authorization", `Bearer ${tokenMonitor}`);

    expect(resposta.status).toBe(200);
    expect(prisma.monitoria.update).toHaveBeenCalledTimes(1);
  });

  it("retorna 403 quando quem tenta cancelar não é o monitor dono da vaga", async () => {
    prisma.monitoria.findUnique.mockResolvedValue({
      id: 1,
      id_monitor: 999,
      status: "ativa",
      horario: em48h,
    });

    const resposta = await request(app)
      .put("/monitorias/1/cancelar")
      .set("Authorization", `Bearer ${tokenMonitor}`);

    expect(resposta.status).toBe(403);
    expect(prisma.monitoria.update).not.toHaveBeenCalled();
  });

  it("retorna 400 (RN-001) quando faltam menos de 24h para o horário da monitoria", async () => {
    prisma.monitoria.findUnique.mockResolvedValue({
      id: 1,
      id_monitor: 10,
      status: "ativa",
      horario: em10h,
    });

    const resposta = await request(app)
      .put("/monitorias/1/cancelar")
      .set("Authorization", `Bearer ${tokenMonitor}`);

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toMatch(/24h/);
    expect(prisma.monitoria.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /monitorias/:id/finalizar (finalização pelo monitor)", () => {
  beforeEach(() => jest.clearAllMocks());

  const inicio = "2026-09-10T14:00:00.000Z";
  const fimValido = "2026-09-10T15:30:00.000Z";
  const vaga = {
    id: 1,
    id_monitor: 10,
    status: "ativa",
    horario: new Date(inicio),
  };

  const finalizar = (token, corpo, id = 1) =>
    request(app)
      .patch(`/monitorias/${id}/finalizar`)
      .set("Authorization", `Bearer ${token}`)
      .send(corpo);

  it("retorna 200 e grava status realizada + data_fim quando o monitor dono finaliza", async () => {
    prisma.monitoria.findUnique
      .mockResolvedValueOnce(vaga)
      .mockResolvedValueOnce({
        ...vaga,
        status: "realizada",
        data_fim: new Date(fimValido),
      });
    prisma.monitoria.updateMany.mockResolvedValue({ count: 1 });

    const resposta = await finalizar(tokenMonitor, { data_fim: fimValido });

    expect(resposta.status).toBe(200);
    expect(resposta.body.monitoria.status).toBe("realizada");
    const { where, data } = prisma.monitoria.updateMany.mock.calls[0][0];
    expect(where).toEqual({
      id: 1,
      id_monitor: 10,
      status: { in: ["ativa", "pendente"] },
    });
    expect(data.status).toBe("realizada");
    expect(data.data_fim).toEqual(new Date(fimValido));
  });

  it("aceita data_fim igual ao início", async () => {
    prisma.monitoria.findUnique.mockResolvedValue(vaga);
    prisma.monitoria.updateMany.mockResolvedValue({ count: 1 });

    const resposta = await finalizar(tokenMonitor, { data_fim: inicio });

    expect(resposta.status).toBe(200);
  });

  it("retorna 400 quando data_fim é anterior ao início da monitoria", async () => {
    prisma.monitoria.findUnique.mockResolvedValue(vaga);

    const resposta = await finalizar(tokenMonitor, {
      data_fim: "2026-09-10T13:59:00.000Z",
    });

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toMatch(/anterior ao início/);
    expect(prisma.monitoria.updateMany).not.toHaveBeenCalled();
  });

  it.each([undefined, "ontem", "2026-09-10"])(
    "retorna 400 para data_fim inválida (%p)",
    async (valor) => {
      const resposta = await finalizar(
        tokenMonitor,
        valor === undefined ? {} : { data_fim: valor },
      );

      expect(resposta.status).toBe(400);
      expect(prisma.monitoria.findUnique).not.toHaveBeenCalled();
    },
  );

  it("retorna 403 quando o monitor não é o dono da vaga", async () => {
    prisma.monitoria.findUnique.mockResolvedValue({ ...vaga, id_monitor: 999 });

    const resposta = await finalizar(tokenMonitor, { data_fim: fimValido });

    expect(resposta.status).toBe(403);
    expect(prisma.monitoria.updateMany).not.toHaveBeenCalled();
  });

  it("retorna 403 quando o token é de um aluno", async () => {
    const resposta = await finalizar(tokenAluno, { data_fim: fimValido });

    expect(resposta.status).toBe(403);
    expect(prisma.monitoria.findUnique).not.toHaveBeenCalled();
  });

  it("retorna 401 sem token", async () => {
    const resposta = await request(app)
      .patch("/monitorias/1/finalizar")
      .send({ data_fim: fimValido });

    expect(resposta.status).toBe(401);
  });

  it("retorna 404 quando a vaga não existe", async () => {
    prisma.monitoria.findUnique.mockResolvedValue(null);

    const resposta = await finalizar(tokenMonitor, { data_fim: fimValido });

    expect(resposta.status).toBe(404);
  });

  it("retorna 400 quando a monitoria já foi finalizada", async () => {
    prisma.monitoria.findUnique.mockResolvedValue({
      ...vaga,
      status: "realizada",
    });

    const resposta = await finalizar(tokenMonitor, { data_fim: fimValido });

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toMatch(/já foi finalizada/);
    expect(prisma.monitoria.updateMany).not.toHaveBeenCalled();
  });

  it("retorna 400 quando a monitoria está cancelada", async () => {
    prisma.monitoria.findUnique.mockResolvedValue({
      ...vaga,
      status: "cancelada",
    });

    const resposta = await finalizar(tokenMonitor, { data_fim: fimValido });

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toMatch(/cancelada/);
    expect(prisma.monitoria.updateMany).not.toHaveBeenCalled();
  });

  it("retorna 400 quando outra requisição finaliza a vaga entre a leitura e a escrita", async () => {
    prisma.monitoria.findUnique.mockResolvedValue(vaga);
    prisma.monitoria.updateMany.mockResolvedValue({ count: 0 });

    const resposta = await finalizar(tokenMonitor, { data_fim: fimValido });

    expect(resposta.status).toBe(400);
  });
});
