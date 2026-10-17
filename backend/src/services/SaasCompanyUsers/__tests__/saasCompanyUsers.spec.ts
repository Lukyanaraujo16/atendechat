const mockTransaction = jest.fn(async (fn: any) =>
  fn({ LOCK: { UPDATE: "UPDATE" } })
);

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));

const mockUsers: any[] = [];

function makeUser(data: any) {
  const u: any = {
    tokenVersion: 0,
    online: false,
    active: true,
    super: false,
    passwordHash: "$2a$08$hash-secreto",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...data
  };
  u.update = jest.fn(async function (this: any, patch: any) {
    Object.assign(this, patch);
    if (patch.password) {
      this.passwordHash = `hashed:${patch.password}`;
      delete this.password;
    }
    return this;
  });
  return u;
}

function matches(u: any, where: any): boolean {
  if (where.companyId !== undefined && u.companyId !== where.companyId) return false;
  if (where.profile !== undefined && u.profile !== where.profile) return false;
  if (where.active !== undefined && u.active !== where.active) return false;
  if (where.id !== undefined) {
    if (typeof where.id === "object") {
      const ne = Object.getOwnPropertySymbols(where.id).map(s => where.id[s])[0];
      if (u.id === ne) return false;
    } else if (u.id !== where.id) {
      return false;
    }
  }
  return true;
}

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async ({ where }: any) => {
      // Busca por e-mail (LOWER(email) = ?) usa Op.and.
      const andKey = Object.getOwnPropertySymbols(where).find(
        s => String(s) === "Symbol(and)"
      );
      if (andKey) {
        const email = where[andKey][0].logic;
        return (
          mockUsers.find(
            u =>
              String(u.email).toLowerCase() === email &&
              (where.id === undefined || matches(u, { id: where.id }))
          ) || null
        );
      }
      return mockUsers.find(u => matches(u, where)) || null;
    }),
    count: jest.fn(async ({ where }: any) => mockUsers.filter(u => matches(u, where)).length),
    create: jest.fn(async (data: any) => {
      const u = makeUser({ id: 900 + mockUsers.length, ...data });
      u.passwordHash = `hashed:${data.password}`;
      delete u.password;
      mockUsers.push(u);
      return u;
    }),
    findAndCountAll: jest.fn(async ({ where, attributes }: any) => {
      const rows = mockUsers.filter(u => u.companyId === where.companyId);
      return {
        count: rows.length,
        rows: rows.map(r => {
          const picked: any = {};
          for (const a of attributes) picked[a] = r[a];
          return picked;
        })
      };
    })
  }
}));

const mockCompanies: Record<number, any> = {
  1: { id: 1, name: "Empresa A", planId: 7 },
  2: { id: 2, name: "Empresa B", planId: null }
};

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn(async (id: number) => mockCompanies[id] || null)
  }
}));

const mockPlan = { id: 7, users: 10 };
jest.mock("../../../models/Plan", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => mockPlan) }
}));

jest.mock("../../CompanyService/CreateCompanyLogService", () => ({
  createCompanyLog: jest.fn(async () => 1)
}));

jest.mock("../../UserFeaturePermission/UserFeaturePermissionService", () => ({
  clearUserFeaturePermissions: jest.fn(async () => undefined),
  loadPlanFeatureMapForCompanyId: jest.fn(async () => ({})),
  seedDefaultUserFeaturePermissions: jest.fn(async () => undefined)
}));

jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

import ListCompanyUsersService from "../ListCompanyUsersService";
import CreateCompanyUserService from "../CreateCompanyUserService";
import UpdateCompanyUserService from "../UpdateCompanyUserService";
import SetCompanyUserActiveService from "../SetCompanyUserActiveService";
import ResetCompanyUserPasswordService from "../ResetCompanyUserPasswordService";
import { createCompanyLog } from "../../CompanyService/CreateCompanyLogService";

const ACTOR = 1;

function seed() {
  mockUsers.length = 0;
  mockUsers.push(
    makeUser({ id: 10, companyId: 1, name: "Admin A", email: "admin@a.com", profile: "admin" }),
    makeUser({ id: 11, companyId: 1, name: "User A", email: "user@a.com", profile: "user" }),
    makeUser({ id: 20, companyId: 2, name: "Admin B", email: "admin@b.com", profile: "admin" }),
    makeUser({ id: 30, companyId: 1, name: "Root", email: "root@a.com", profile: "admin", super: true })
  );
  mockPlan.users = 10;
}

async function expectError(p: Promise<unknown>, code: string, status: number) {
  await expect(p).rejects.toMatchObject({ message: code, statusCode: status });
}

describe("SaasCompanyUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seed();
  });

  it("lista somente usuários da empresa e nunca retorna hash", async () => {
    const out = await ListCompanyUsersService({ companyId: 1 });
    expect(out.count).toBe(3);
    expect(out.hasMore).toBe(false);
    for (const u of out.users) {
      expect(Object.keys(u).sort()).toEqual(
        ["active", "createdAt", "email", "id", "name", "online", "profile", "super"]
      );
      expect((u as any).passwordHash).toBeUndefined();
    }
    expect(out.users.map(u => u.id)).not.toContain(20);
  });

  it("empresa inexistente → 404", async () => {
    await expectError(ListCompanyUsersService({ companyId: 99 }), "ERR_NO_COMPANY_FOUND", 404);
  });

  it("cria usuário sem expor hash e registra auditoria sem senha", async () => {
    const user = await CreateCompanyUserService({
      companyId: 1,
      actorUserId: ACTOR,
      data: { name: " Novo ", email: "Novo@A.com", password: "Senha123", profile: "user" }
    });
    expect(user).toMatchObject({ name: "Novo", email: "novo@a.com", profile: "user", super: false });
    expect((user as any).passwordHash).toBeUndefined();
    const created = mockUsers.find(u => u.email === "novo@a.com");
    expect(created.mustChangePassword).toBe(true);
    expect(created.super).toBe(false);
    const logArg = (createCompanyLog as jest.Mock).mock.calls[0][0];
    expect(logArg.action).toBe("user_create");
    expect(JSON.stringify(logArg)).not.toMatch(/Senha123|hash/i);
  });

  it("não permite criar super/superadmin", async () => {
    await expectError(
      CreateCompanyUserService({
        companyId: 1,
        actorUserId: ACTOR,
        data: { name: "X Y", email: "x@a.com", password: "Senha123", profile: "super" }
      }),
      "ERR_INVALID_PROFILE",
      400
    );
  });

  it("e-mail duplicado (global, sem diferenciar maiúsculas) → 409", async () => {
    await expectError(
      CreateCompanyUserService({
        companyId: 1,
        actorUserId: ACTOR,
        data: { name: "Dup", email: "ADMIN@b.com", password: "Senha123", profile: "user" }
      }),
      "ERR_EMAIL_ALREADY_IN_USE",
      409
    );
  });

  it("senha fraca é rejeitada", async () => {
    await expectError(
      CreateCompanyUserService({
        companyId: 1,
        actorUserId: ACTOR,
        data: { name: "Fraca", email: "f@a.com", password: "1234567", profile: "user" }
      }),
      "ERR_PASSWORD_TOO_SHORT",
      400
    );
  });

  it("limite de usuários do plano → 409", async () => {
    mockPlan.users = 3;
    await expectError(
      CreateCompanyUserService({
        companyId: 1,
        actorUserId: ACTOR,
        data: { name: "Extra", email: "e@a.com", password: "Senha123", profile: "user" }
      }),
      "ERR_PLAN_USER_LIMIT",
      409
    );
  });

  it("usuário de outra empresa → 404 (isolamento)", async () => {
    await expectError(
      UpdateCompanyUserService({ companyId: 1, userId: 20, actorUserId: ACTOR, data: { name: "Hack" } }),
      "ERR_USER_NOT_FOUND",
      404
    );
    await expectError(
      SetCompanyUserActiveService({ companyId: 1, userId: 20, actorUserId: ACTOR, active: false }),
      "ERR_USER_NOT_FOUND",
      404
    );
    await expectError(
      ResetCompanyUserPasswordService({ companyId: 1, userId: 20, actorUserId: ACTOR, password: "Senha123" }),
      "ERR_USER_NOT_FOUND",
      404
    );
    expect(mockUsers.find(u => u.id === 20).update).not.toHaveBeenCalled();
  });

  it("usuário super não pode ser alterado por esta rota", async () => {
    await expectError(
      UpdateCompanyUserService({ companyId: 1, userId: 30, actorUserId: ACTOR, data: { profile: "user" } }),
      "ERR_SUPER_USER_PROTECTED",
      403
    );
  });

  it("rebaixar o último admin ativo → 409 ERR_LAST_ADMIN", async () => {
    // Root (super) é admin mas também conta; desativa-o para isolar o cenário.
    mockUsers.find(u => u.id === 30).active = false;
    await expectError(
      UpdateCompanyUserService({ companyId: 1, userId: 10, actorUserId: ACTOR, data: { profile: "user" } }),
      "ERR_LAST_ADMIN",
      409
    );
    expect(mockUsers.find(u => u.id === 10).profile).toBe("admin");
  });

  it("desativar o último admin ativo → 409 ERR_LAST_ADMIN", async () => {
    mockUsers.find(u => u.id === 30).active = false;
    await expectError(
      SetCompanyUserActiveService({ companyId: 1, userId: 10, actorUserId: ACTOR, active: false }),
      "ERR_LAST_ADMIN",
      409
    );
  });

  it("desativar admin quando há outro admin ativo invalida sessões", async () => {
    mockUsers.push(
      makeUser({ id: 12, companyId: 1, name: "Admin 2", email: "a2@a.com", profile: "admin" })
    );
    const out = await SetCompanyUserActiveService({
      companyId: 1,
      userId: 10,
      actorUserId: ACTOR,
      active: false
    });
    expect(out.active).toBe(false);
    const u = mockUsers.find(x => x.id === 10);
    expect(u.tokenVersion).toBe(1);
    expect(u.online).toBe(false);
    expect((createCompanyLog as jest.Mock).mock.calls[0][0].action).toBe("user_deactivate");
  });

  it("promover user a admin e editar nome/e-mail", async () => {
    const out = await UpdateCompanyUserService({
      companyId: 1,
      userId: 11,
      actorUserId: ACTOR,
      data: { name: "User Editado", email: "novo-email@a.com", profile: "admin" }
    });
    expect(out).toMatchObject({ name: "User Editado", email: "novo-email@a.com", profile: "admin" });
    const log = (createCompanyLog as jest.Mock).mock.calls[0][0];
    expect(log.metadata.before).toEqual({ name: "User A", email: "user@a.com", profile: "user" });
  });

  it("troca de senha: mustChangePassword=true, tokenVersion++ e sem hash na resposta", async () => {
    const out = await ResetCompanyUserPasswordService({
      companyId: 1,
      userId: 11,
      actorUserId: ACTOR,
      password: "NovaSenha1"
    });
    const u = mockUsers.find(x => x.id === 11);
    expect(u.mustChangePassword).toBe(true);
    expect(u.tokenVersion).toBe(1);
    expect(u.passwordHash).toBe("hashed:NovaSenha1");
    expect((out as any).passwordHash).toBeUndefined();
    expect((out as any).password).toBeUndefined();
    const log = (createCompanyLog as jest.Mock).mock.calls[0][0];
    expect(log.action).toBe("user_password_reset");
    expect(JSON.stringify(log)).not.toMatch(/NovaSenha1|hash/i);
  });

  it("troca de senha com menos de 8 caracteres → 400", async () => {
    await expectError(
      ResetCompanyUserPasswordService({ companyId: 1, userId: 11, actorUserId: ACTOR, password: "Ab1" }),
      "ERR_PASSWORD_TOO_SHORT",
      400
    );
  });

  it("active deve ser booleano", async () => {
    await expectError(
      SetCompanyUserActiveService({ companyId: 1, userId: 11, actorUserId: ACTOR, active: "false" }),
      "ERR_INVALID_ACTIVE",
      400
    );
  });
});
