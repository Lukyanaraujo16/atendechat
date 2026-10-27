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
jest.mock("../SystemMonitorService", () => ({
  getSystemMonitorSnapshot: jest.fn()
}));
jest.mock("../../../controllers/SystemUpdateController", () => ({
  getCurrent: jest.fn(),
  runAction: jest.fn()
}));

function buildApp() {
  const app = express();
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
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(mockSnapshot).toHaveBeenCalledTimes(1);
  });
});
