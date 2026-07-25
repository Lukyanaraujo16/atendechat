/**
 * Fase 1.4 — proteção de entrada do stack AgentOS Console.
 */
import AppError from "../../errors/AppError";

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../../services/PlatformUserPermissionService", () => ({
  hasPlatformPermission: jest.fn()
}));

jest.mock("../../services/AutomationOrchestrator/security/AgentOsSecurityConfig", () => ({
  getAgentOsSecurityConfig: () => ({ requireConfirmationForSensitiveOps: false })
}));

jest.mock("../isAuth", () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    if (!req.user?.id) {
      next(new (require("../../errors/AppError").default)("ERR_SESSION_EXPIRED", 401));
      return;
    }
    next();
  }
}));

jest.mock("../requireEffectiveModule", () => ({
  __esModule: true,
  default: () => (_req: any, _res: any, next: any) => next()
}));

jest.mock("../agentOsRateLimit", () => ({
  agentOsAutoRateLimit: (_req: any, _res: any, next: any) => next()
}));

jest.mock("../agentOsPayloadGuard", () => ({
  __esModule: true,
  default: (_req: any, _res: any, next: any) => next()
}));

import User from "../../models/User";
import { hasPlatformPermission } from "../../services/PlatformUserPermissionService";
import { agentOsStacks } from "../agentOsAdminStack";
import { PLATFORM_PERMISSION_KEYS } from "../../config/platformPermissionConstants";

const findByPk = User.findByPk as jest.Mock;
const hasPerm = hasPlatformPermission as jest.Mock;

function runStack(
  stack: any[],
  req: any
): Promise<{ err?: any }> {
  return new Promise(resolve => {
    const res: any = {
      on: () => res,
      statusCode: 200
    };
    let i = 0;
    const next = (err?: any) => {
      if (err) {
        resolve({ err });
        return;
      }
      i += 1;
      if (i >= stack.length) {
        resolve({});
        return;
      }
      try {
        const maybe = stack[i](req, res, next);
        if (maybe && typeof maybe.then === "function") {
          maybe.catch((e: any) => next(e));
        }
      } catch (e) {
        next(e);
      }
    };
    try {
      const maybe = stack[0](req, res, next);
      if (maybe && typeof maybe.then === "function") {
        maybe.catch((e: any) => next(e));
      }
    } catch (e) {
      next(e);
    }
  });
}

describe("Fase 1.4 — agentOsAdminStack / console gate", () => {
  beforeEach(() => {
    findByPk.mockReset();
    hasPerm.mockReset();
  });

  it("admin tenant com features → 403 interno", async () => {
    findByPk.mockResolvedValue({ id: 10, super: false, profile: "admin" });
    const stack = agentOsStacks.monitor();
    const { err } = await runStack(stack, {
      method: "GET",
      path: "/automation/observability/dashboard",
      baseUrl: "",
      user: { id: "10", profile: "admin", companyId: 1 },
      query: {},
      body: {}
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_INTERNAL_ACCESS_REQUIRED");
  });

  it("admin em supportMode → 403 (support não autoriza)", async () => {
    findByPk.mockResolvedValue({ id: 11, super: false, profile: "admin" });
    const stack = agentOsStacks.monitor();
    const { err } = await runStack(stack, {
      method: "GET",
      path: "/automation/evidence/dashboard",
      baseUrl: "",
      user: {
        id: "11",
        profile: "admin",
        companyId: 5,
        supportMode: true
      },
      query: {},
      body: {}
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_INTERNAL_ACCESS_REQUIRED");
  });

  it("interno sem console.view → 403", async () => {
    findByPk.mockResolvedValue({ id: 12, super: true, profile: "admin" });
    hasPerm.mockResolvedValue(false);
    const stack = agentOsStacks.monitor();
    const { err } = await runStack(stack, {
      method: "GET",
      path: "/automation/execution/sessions",
      baseUrl: "",
      user: { id: "12", profile: "admin", companyId: 1, super: true },
      query: {},
      body: {}
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_PERMISSION_DENIED");
  });

  it("interno com console.view + GET → permitido", async () => {
    findByPk.mockResolvedValue({ id: 13, super: true, profile: "admin" });
    hasPerm.mockImplementation(async (_id: number, key: string) => {
      return key === PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_VIEW;
    });
    const stack = agentOsStacks.monitor();
    const { err } = await runStack(stack, {
      method: "GET",
      path: "/automation/observability/health",
      baseUrl: "",
      user: { id: "13", profile: "admin", companyId: 2, super: true },
      query: {},
      body: {}
    });
    expect(err).toBeUndefined();
  });

  it("interno com view mas POST sem manage → 403", async () => {
    findByPk.mockResolvedValue({ id: 14, super: true, profile: "admin" });
    hasPerm.mockImplementation(async (_id: number, key: string) => {
      return key === PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_VIEW;
    });
    const stack = agentOsStacks.core();
    const { err } = await runStack(stack, {
      method: "POST",
      path: "/automation/tools/test/x",
      baseUrl: "",
      user: { id: "14", profile: "admin", companyId: 2, super: true },
      query: {},
      body: { confirm: true }
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_PERMISSION_DENIED");
  });

  it("interno com view + manage + POST → permitido", async () => {
    findByPk.mockResolvedValue({ id: 15, super: true, profile: "admin" });
    hasPerm.mockImplementation(async (_id: number, key: string) => {
      return (
        key === PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_VIEW ||
        key === PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_MANAGE
      );
    });
    const stack = agentOsStacks.tester();
    const { err } = await runStack(stack, {
      method: "POST",
      path: "/automation/tools/test/x",
      baseUrl: "",
      user: { id: "15", profile: "admin", companyId: 2, super: true },
      query: {},
      body: { confirm: true }
    });
    expect(err).toBeUndefined();
  });

  it("interno com view + rollout.manage em POST rollout → permitido", async () => {
    findByPk.mockResolvedValue({ id: 16, super: true, profile: "admin" });
    hasPerm.mockImplementation(async (_id: number, key: string) => {
      return (
        key === PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_VIEW ||
        key === PLATFORM_PERMISSION_KEYS.AGENTOS_ROLLOUT_MANAGE
      );
    });
    const stack = agentOsStacks.monitor();
    const { err } = await runStack(stack, {
      method: "POST",
      path: "/automation/rollout/transition",
      baseUrl: "",
      user: { id: "16", profile: "admin", companyId: 2, super: true },
      query: {},
      body: { confirm: true }
    });
    expect(err).toBeUndefined();
  });

  it("companyId arbitrário na query → bloqueado", async () => {
    findByPk.mockResolvedValue({ id: 17, super: true, profile: "admin" });
    hasPerm.mockResolvedValue(true);
    const stack = agentOsStacks.monitor();
    const { err } = await runStack(stack, {
      method: "GET",
      path: "/automation/production",
      baseUrl: "",
      user: { id: "17", profile: "admin", companyId: 2, super: true },
      query: { companyId: "999" },
      body: {}
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_AGENTOS_TENANT_ACCESS_DENIED");
  });

  it("ordem do stack: console → tenant → features (tenant antes da feature)", () => {
    const stack = agentOsStacks.monitor();
    const { requireAgentOsConsole } = require("../requirePlatformPermission");
    const requireAgentOsTenantContext = require("../requireAgentOsTenantContext")
      .default;
    expect(stack[1]).toBe(requireAgentOsConsole);
    expect(stack[2]).toBe(requireAgentOsTenantContext);
  });

  it("não autenticado → 401", async () => {
    const stack = agentOsStacks.monitor();
    const { err } = await runStack(stack, {
      method: "GET",
      path: "/automation/production",
      baseUrl: "",
      user: undefined,
      query: {},
      body: {}
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });
});
