import AppError from "../../errors/AppError";

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../services/PlatformUserPermissionService", () => ({
  hasPlatformPermission: jest.fn()
}));

import User from "../../models/User";
import { hasPlatformPermission } from "../../services/PlatformUserPermissionService";
import {
  requirePlatformPermission,
  requireAgentOsConsole
} from "../requirePlatformPermission";

const findByPk = User.findByPk as jest.Mock;
const hasPerm = hasPlatformPermission as jest.Mock;

function mockRes() {
  return {} as any;
}

function run(
  mw: (req: any, res: any, next: any) => any,
  req: any
): Promise<{ err?: any }> {
  return new Promise(resolve => {
    mw(req, mockRes(), (err?: any) => resolve({ err }));
  });
}

describe("requirePlatformPermission / requireAgentOsConsole", () => {
  beforeEach(() => {
    findByPk.mockReset();
    hasPerm.mockReset();
  });

  it("Caso H — não autenticado → 401", async () => {
    const { err } = await run(requireAgentOsConsole, { user: undefined });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_SESSION_EXPIRED");
    expect(err.statusCode).toBe(401);
  });

  it("Caso A — admin comum com features de plano → 403 interno", async () => {
    findByPk.mockResolvedValue({ id: 2, super: false, profile: "admin" });
    const { err } = await run(requireAgentOsConsole, {
      user: { id: "2", profile: "admin", companyId: 1 }
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_INTERNAL_ACCESS_REQUIRED");
    expect(err.statusCode).toBe(403);
    expect(hasPerm).not.toHaveBeenCalled();
  });

  it("Caso B — super sem permission → 403 deny by default", async () => {
    findByPk.mockResolvedValue({ id: 3, super: true, profile: "admin" });
    hasPerm.mockResolvedValue(false);
    const { err } = await run(requireAgentOsConsole, {
      user: { id: "3", profile: "admin", companyId: 1 }
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_PERMISSION_DENIED");
    expect(err.statusCode).toBe(403);
  });

  it("Caso C — super com agentOS.console.view → next()", async () => {
    findByPk.mockResolvedValue({ id: 4, super: true, profile: "admin" });
    hasPerm.mockResolvedValue(true);
    const { err } = await run(requireAgentOsConsole, {
      user: { id: "4", profile: "admin", companyId: 1 }
    });
    expect(err).toBeUndefined();
  });

  it("Caso D — profile=superadmin com permission → next()", async () => {
    findByPk.mockResolvedValue({
      id: 5,
      super: false,
      profile: "superadmin"
    });
    hasPerm.mockResolvedValue(true);
    const { err } = await run(requireAgentOsConsole, {
      user: { id: "5", profile: "superadmin", companyId: null }
    });
    expect(err).toBeUndefined();
  });

  it("Caso E — supportMode admin comum sem permissão → 403", async () => {
    findByPk.mockResolvedValue({ id: 6, super: false, profile: "admin" });
    const { err } = await run(requireAgentOsConsole, {
      user: {
        id: "6",
        profile: "admin",
        companyId: 99,
        supportMode: true
      }
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_INTERNAL_ACCESS_REQUIRED");
    expect(err.statusCode).toBe(403);
  });

  it("Caso F — super em supportMode com permission → next()", async () => {
    findByPk.mockResolvedValue({ id: 7, super: true, profile: "admin" });
    hasPerm.mockResolvedValue(true);
    const { err } = await run(requireAgentOsConsole, {
      user: {
        id: "7",
        profile: "admin",
        companyId: 50,
        supportMode: true
      }
    });
    expect(err).toBeUndefined();
    expect(hasPerm).toHaveBeenCalledWith(7, "agentOS.console.view");
  });

  it("Caso G — permissão desabilitada → 403", async () => {
    findByPk.mockResolvedValue({ id: 8, super: true, profile: "admin" });
    hasPerm.mockResolvedValue(false);
    const { err } = await run(
      requirePlatformPermission("agentOS.console.manage"),
      { user: { id: "8", profile: "admin", companyId: 1 } }
    );
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_PERMISSION_DENIED");
  });
});
