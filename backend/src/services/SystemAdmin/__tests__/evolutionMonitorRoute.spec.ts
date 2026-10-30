/**
 * GET /system/evolution-monitor — proteção isAuth + isSuper existentes.
 */
import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";

import systemAdminRoutes from "../../../routes/systemAdminRoutes";
import AppError from "../../../errors/AppError";
import authConfig from "../../../config/auth";

const mockFindByPk = jest.fn();
const mockSnapshot = jest.fn();
const mockInfra = jest.fn();
const mockHistory = jest.fn();
const mockWhatsappMonitor = jest.fn();

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findByPk: (...args: any[]) => mockFindByPk(...args) }
}));
jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));
jest.mock("../EvolutionMonitorService", () => ({
  getEvolutionMonitorSnapshot: (...args: any[]) => mockSnapshot(...args)
}));
jest.mock("../EvolutionInfraMetricsService", () => ({
  ...jest.requireActual("../EvolutionInfraMetricsService"),
  getEvolutionInfraCurrent: (...args: any[]) => mockInfra(...args),
  getEvolutionInfraHistory: (...args: any[]) => mockHistory(...args)
}));
jest.mock("../WhatsappMonitorService", () => ({
  ...jest.requireActual("../WhatsappMonitorService"),
  getWhatsappMonitor: (...args: any[]) => mockWhatsappMonitor(...args)
}));
jest.mock("../../../libs/wbot", () => ({ getWbot: jest.fn() }));
jest.mock("../../../models/Whatsapp", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/EvolutionMetricSample", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../SystemMonitorService", () => ({
  getSystemMonitorSnapshot: jest.fn()
}));
jest.mock("../../../controllers/SystemUpdateController", () => ({
  getCurrent: jest.fn(),
  runAction: jest.fn()
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(systemAdminRoutes);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: "ERR_INTERNAL" });
  });
  return app;
}

const token = sign(
  { id: 42, profile: "admin", companyId: 3 },
  authConfig.secret,
  {
    expiresIn: "5m"
  }
);

jest.setTimeout(60000);

describe("GET /system/evolution-monitor", () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshot.mockResolvedValue({
      api: { status: "online" },
      instances: []
    });
    mockInfra.mockResolvedValue({ collector: { status: "online" } });
    mockHistory.mockResolvedValue({ range: "24h", points: [] });
  });

  it("sem token → 401", async () => {
    const res = await request(app).get("/system/evolution-monitor");
    expect(res.status).toBe(401);
    expect(mockSnapshot).not.toHaveBeenCalled();
  });

  it("usuário comum (admin de empresa) é bloqueado", async () => {
    mockFindByPk.mockResolvedValue({ super: false, profile: "admin" });
    const res = await request(app)
      .get("/system/evolution-monitor")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Acesso não permitido");
    expect(mockSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    [{ super: true, profile: "admin" }],
    [{ super: false, profile: "superadmin" }]
  ])("super admin %p recebe snapshot sem cache HTTP", async row => {
    mockFindByPk.mockResolvedValue(row);
    const res = await request(app)
      .get("/system/evolution-monitor")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.api.status).toBe("online");
    expect(res.body.infra.collector.status).toBe("online");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(mockSnapshot).toHaveBeenCalledTimes(1);
  });

  describe("GET /system/whatsapp-monitor", () => {
    beforeEach(() => {
      mockWhatsappMonitor.mockResolvedValue({
        summary: { total: 0 },
        connections: { rows: [], total: 0, page: 1, pageSize: 25 }
      });
    });

    it("sem token → 401", async () => {
      const res = await request(app).get("/system/whatsapp-monitor");
      expect(res.status).toBe(401);
      expect(mockWhatsappMonitor).not.toHaveBeenCalled();
    });

    it("usuário comum (admin de empresa) é bloqueado", async () => {
      mockFindByPk.mockResolvedValue({ super: false, profile: "admin" });
      const res = await request(app)
        .get("/system/whatsapp-monitor")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(mockWhatsappMonitor).not.toHaveBeenCalled();
    });

    it("super admin: repassa filtros, paginação e ordenação validados", async () => {
      mockFindByPk.mockResolvedValue({ super: true, profile: "admin" });
      const res = await request(app)
        .get(
          "/system/whatsapp-monitor?provider=baileys&status=unconfirmed&companyId=7&search=%20loja%20&page=2&pageSize=50&sortBy=status&sortDir=desc"
        )
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(mockWhatsappMonitor).toHaveBeenCalledWith({
        provider: "baileys",
        status: "unconfirmed",
        companyId: 7,
        search: "loja",
        page: 2,
        pageSize: 50,
        sortBy: "status",
        sortDir: "desc"
      });
    });

    it("defaults quando nada é informado", async () => {
      mockFindByPk.mockResolvedValue({ super: true, profile: "admin" });
      await request(app)
        .get("/system/whatsapp-monitor")
        .set("Authorization", `Bearer ${token}`);
      expect(mockWhatsappMonitor).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 25, sortBy: "company", sortDir: "asc" })
      );
    });

    it.each([
      "provider=wppconnect",
      "status=online",
      "sortBy=session",
      "companyId=1%20OR%201=1"
    ])("parâmetro inválido (%s) → 400", async qs => {
      mockFindByPk.mockResolvedValue({ super: true, profile: "admin" });
      const res = await request(app)
        .get(`/system/whatsapp-monitor?${qs}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(mockWhatsappMonitor).not.toHaveBeenCalled();
    });
  });

  describe("GET /system/evolution-monitor/history", () => {
    it("sem token → 401", async () => {
      const res = await request(app).get("/system/evolution-monitor/history");
      expect(res.status).toBe(401);
      expect(mockHistory).not.toHaveBeenCalled();
    });

    it("usuário comum é bloqueado", async () => {
      mockFindByPk.mockResolvedValue({ super: false, profile: "admin" });
      const res = await request(app)
        .get("/system/evolution-monitor/history?range=7d")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(mockHistory).not.toHaveBeenCalled();
    });

    it("super admin: aceita 24h/7d e recusa outro intervalo", async () => {
      mockFindByPk.mockResolvedValue({ super: true, profile: "admin" });
      const ok = await request(app)
        .get("/system/evolution-monitor/history?range=7d")
        .set("Authorization", `Bearer ${token}`);
      expect(ok.status).toBe(200);
      expect(mockHistory).toHaveBeenCalledWith("7d");
      const bad = await request(app)
        .get("/system/evolution-monitor/history?range=30d")
        .set("Authorization", `Bearer ${token}`);
      expect(bad.status).toBe(400);
    });
  });

  describe("POST /system/evolution-metrics (coletor)", () => {
    const OLD = process.env.EVOLUTION_METRICS_INGEST_TOKEN;
    const INGEST = "i".repeat(48);
    beforeEach(() => {
      process.env.EVOLUTION_METRICS_INGEST_TOKEN = INGEST;
    });
    afterAll(() => {
      process.env.EVOLUTION_METRICS_INGEST_TOKEN = OLD;
    });

    it("não aceita JWT de usuário (nem de super admin) como credencial", async () => {
      mockFindByPk.mockResolvedValue({ super: true, profile: "admin" });
      const res = await request(app)
        .post("/system/evolution-metrics")
        .set("Authorization", `Bearer ${token}`)
        .send({ samples: [] });
      expect(res.status).toBe(401);
      expect(mockFindByPk).not.toHaveBeenCalled();
    });

    it("sem token → 401; ingestão desligada → 503", async () => {
      const missing = await request(app)
        .post("/system/evolution-metrics")
        .send({ samples: [] });
      expect(missing.status).toBe(401);
      delete process.env.EVOLUTION_METRICS_INGEST_TOKEN;
      const disabled = await request(app)
        .post("/system/evolution-metrics")
        .set("Authorization", `Bearer ${INGEST}`)
        .send({ samples: [] });
      expect(disabled.status).toBe(503);
    });

    it("token certo + payload inválido → 400 com o campo", async () => {
      const res = await request(app)
        .post("/system/evolution-metrics")
        .set("Authorization", `Bearer ${INGEST}`)
        .send({ samples: [{ source: "x" }] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "ERR_EVOLUTION_METRICS_INVALID",
        detail: expect.stringContaining("samples[0]")
      });
    });
  });
});
