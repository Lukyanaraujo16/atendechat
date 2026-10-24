/**
 * Integração (Postgres real) — Segurança 2: dados de Company no login e no refresh.
 * Qualquer perfil da empresa recebe `user.company` no login; não pode levar campos de Super Admin
 * (internalNotes, contractedPlanValue), dados cadastrais nem Settings com tokens de integração.
 */
import "express-async-errors";
import { Router } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import sequelize from "../database";
import Setting from "../models/Setting";
import authRoutes from "../routes/authRoutes";
import { LOGIN_COMPANY_ATTRIBUTES } from "../services/UserServices/AuthUserService";
import { buildApp } from "./helpers/miniApp";
import { assertDisposableDatabase, createCompany, createUser, daysFromToday } from "./helpers/fixtures";

jest.mock("../libs/socket", () => ({ getIO: () => ({ to: () => ({ emit: () => undefined }) }) }));

const PASSWORD = "senha-it-123456";
const SECRETS = ["nota interna da plataforma", "12345678000199", "Rua Interna", "5511999990000", "Razao Social IT", "tok-asaas-secreto", "tok-ixc-secreto"];
const FORBIDDEN_KEYS = ["internalNotes", "contractedPlanValue", "document", "documentType", "legalName", "tradeName", "phone",
  "addressStreet", "addressNumber", "addressCity", "addressZipCode", "schedules", "storageUsedBytes", "storageLimitGb", "planId", "recurrence"];

describe("Segurança 2 — Company no login e no refresh (Postgres real)", () => {
  const router = Router();
  router.use(cookieParser());
  router.use("/auth", authRoutes);
  const app = buildApp([router]);
  let company: any;
  const users: Record<string, any> = {};

  beforeAll(async () => {
    await assertDisposableDatabase();
    company = await createCompany({ dueDate: daysFromToday(20) });
    await company.update({
      internalNotes: "nota interna da plataforma",
      contractedPlanValue: 12.34,
      document: "12345678000199",
      legalName: "Razao Social IT",
      phone: "5511999990000",
      addressStreet: "Rua Interna",
      email: "contato@empresa-it.example",
      modulePermissions: { campaigns: true }
    } as any);
    await Setting.bulkCreate([
      { key: "campaignsEnabled", value: "true", companyId: company.id },
      { key: "asaas", value: "tok-asaas-secreto", companyId: company.id },
      { key: "tokenixc", value: "tok-ixc-secreto", companyId: company.id }
    ] as any[]);
    for (const profile of ["user", "supervisor", "admin"]) users[profile] = await createUser({ companyId: company.id, profile });
    users.super = await createUser({ companyId: company.id, superUser: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const login = (u: any) => request(app).post("/auth/login").send({ email: u.email, password: PASSWORD });
  const jrtOf = (res: request.Response) =>
    ((res.headers["set-cookie"] as unknown as string[]) || []).find(c => c.startsWith("jrt="))!.split(";")[0];

  function expectNoExposure(body: any) {
    const wire = JSON.stringify(body);
    for (const s of SECRETS) expect(wire).not.toContain(s);
    for (const k of FORBIDDEN_KEYS) expect(body.user.company).not.toHaveProperty(k);
  }

  it.each(["user", "supervisor", "admin", "super"])("login (%s): company só com os campos da sessão e Settings filtradas", async profile => {
    const res = await login(users[profile]);
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(jrtOf(res)).toMatch(/^jrt=/);

    const c = res.body.user.company;
    const settings = c.settings;
    expect(Object.keys(c).filter(k => k !== "settings").sort()).toEqual([...LOGIN_COMPANY_ATTRIBUTES].sort());
    expect(c).toMatchObject({
      id: company.id,
      email: "contato@empresa-it.example",
      modulePermissions: { campaigns: true }
    });
    expect(settings.map((s: any) => s.key)).toEqual(["campaignsEnabled"]);
    expect(settings[0]).toEqual({ key: "campaignsEnabled", value: "true" });
    expectNoExposure(res.body);

    // Contrato da sessão preservado: finance, features, permissões e perfil.
    expect(res.body.user).toMatchObject({ id: users[profile].id, companyId: company.id, profile: users[profile].profile });
    expect(res.body.user.finance).toMatchObject({ overdue: false, delinquent: false });
    expect(res.body.user.finance.dueDate).toBeTruthy();
    expect(res.body.user).toHaveProperty("effectiveUserFeatures");
    expect(res.body.user).toHaveProperty("platformPermissions");
    expect(res.body.user.super).toBe(profile === "super");
  });

  it("refresh depois do login segue funcionando, sem campos internos e sem novo pedido de login", async () => {
    for (const profile of ["user", "super"]) {
      const first = await login(users[profile]);
      const refreshed = await request(app).post("/auth/refresh_token").set("Cookie", jrtOf(first));
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.token).toEqual(expect.any(String));
      expect(refreshed.body.user).toMatchObject({ id: users[profile].id, companyId: company.id });
      expect(refreshed.body.user.company.dueDate).toBeTruthy();
      expectNoExposure(refreshed.body);
      // O refresh devolve um novo cookie: a sessão continua sem loop de login.
      const again = await request(app).post("/auth/refresh_token").set("Cookie", jrtOf(refreshed));
      expect(again.status).toBe(200);
    }
  });

  it("credenciais inválidas continuam recusadas", async () => {
    const res = await request(app).post("/auth/login").send({ email: users.user.email, password: "errada" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("ERR_INVALID_CREDENTIALS");
  });

  it("empresa sem a Setting campaignsEnabled: login funciona com settings vazio", async () => {
    const other = await createCompany({ dueDate: daysFromToday(20) });
    await Setting.create({ key: "asaas", value: "tok-asaas-secreto", companyId: other.id } as any);
    const u = await createUser({ companyId: other.id, profile: "user" });
    const res = await login(u);
    expect(res.status).toBe(200);
    expect(res.body.user.company.settings).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain("tok-asaas-secreto");
  });
});
