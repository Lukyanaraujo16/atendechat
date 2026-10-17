/**
 * Rotas /saas/companies/:companyId/users — proteção isAuth + isSuper.
 * Usuário autenticado não-super não alcança o controller.
 */
import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";

const mockFindByPk = jest.fn();

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findByPk: (...args: any[]) => mockFindByPk(...args) }
}));

jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

const mockController = {
  index: jest.fn((req: Request, res: Response) => res.status(200).json({ ok: true })),
  store: jest.fn((req: Request, res: Response) => res.status(201).json({ ok: true })),
  update: jest.fn((req: Request, res: Response) => res.status(200).json({ ok: true })),
  setActive: jest.fn((req: Request, res: Response) => res.status(200).json({ ok: true })),
  resetPassword: jest.fn((req: Request, res: Response) => res.status(200).json({ ok: true }))
};

jest.mock("../../../controllers/SaasCompanyUsersController", () => mockController);

import saasCompanyUsersRoutes from "../../../routes/saasCompanyUsersRoutes";
import AppError from "../../../errors/AppError";
import authConfig from "../../../config/auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(saasCompanyUsersRoutes);
  // Mesmo mapeamento de AppError usado em app.ts.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.clientMessage ? { message: err.clientMessage } : {})
      });
    }
    return res.status(500).json({ error: "ERR_INTERNAL" });
  });
  return app;
}

const token = sign({ id: 42, profile: "admin", companyId: 3 }, authConfig.secret, {
  expiresIn: "5m"
});

const calls: Array<[string, string, Record<string, unknown>]> = [
  ["get", "/saas/companies/1/users", {}],
  ["post", "/saas/companies/1/users", { name: "X", email: "x@a.com", password: "Senha123", profile: "user" }],
  ["put", "/saas/companies/1/users/10", { name: "Y" }],
  ["patch", "/saas/companies/1/users/10/active", { active: false }],
  ["post", "/saas/companies/1/users/10/password", { password: "Senha123" }]
];

jest.setTimeout(60000);

describe("saasCompanyUsersRoutes", () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  it.each(calls)("%s %s sem token → 401", async (method, url, body) => {
    const res = await (request(app) as any)[method](url).send(body);
    expect(res.status).toBe(401);
    expect(mockFindByPk).not.toHaveBeenCalled();
  });

  it.each(calls)("%s %s com admin de empresa (não-super) é bloqueado", async (method, url, body) => {
    mockFindByPk.mockResolvedValue({ super: false, profile: "admin" });
    const res = await (request(app) as any)[method](url)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    // middleware isSuper existente responde 401 "Acesso não permitido" (não 403).
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Acesso não permitido");
    for (const fn of Object.values(mockController)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("super admin alcança o controller", async () => {
    mockFindByPk.mockResolvedValue({ super: true, profile: "admin" });
    const res = await request(app)
      .get("/saas/companies/1/users")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockController.index).toHaveBeenCalledTimes(1);
  });
});
