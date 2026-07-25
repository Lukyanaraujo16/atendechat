jest.mock("../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../companyFinanceStatus", () => ({
  getCompanyFinanceFlags: jest.fn(() => ({
    overdue: false,
    delinquent: false,
    dueDate: null,
    daysPastDue: null
  }))
}));

jest.mock("../../middleware/loadCompanyEffectiveFeatures", () => ({
  loadCompanyPlanContextByCompanyId: jest.fn(async () => null)
}));

jest.mock(
  "../../services/UserFeaturePermission/UserFeaturePermissionService",
  () => ({
    computeEffectiveUserFeatureMapForUserId: jest.fn(async () => ({}))
  })
);

jest.mock("../../services/PlatformUserPermissionService", () => ({
  listEnabledPlatformPermissions: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { listEnabledPlatformPermissions } from "../../services/PlatformUserPermissionService";
import { SerializeUser, serializeUserForSession } from "../SerializeUser";

const listPerms = listEnabledPlatformPermissions as jest.Mock;

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Test",
    email: "t@example.com",
    profile: "admin",
    companyId: 10,
    company: null,
    super: false,
    queues: [],
    allTicket: "disable",
    mustChangePassword: false,
    ...overrides
  } as any;
}

describe("SerializeUser — platform identity", () => {
  beforeEach(() => {
    listPerms.mockReset();
  });

  it("admin comum → isInternalUser false e platformPermissions []", async () => {
    const out = await SerializeUser(baseUser());
    expect(out.isInternalUser).toBe(false);
    expect(out.platformPermissions).toEqual([]);
    expect(listPerms).not.toHaveBeenCalled();
  });

  it("super sem grant → isInternalUser true e lista vazia", async () => {
    listPerms.mockResolvedValue([]);
    const out = await SerializeUser(baseUser({ super: true }));
    expect(out.isInternalUser).toBe(true);
    expect(out.platformPermissions).toEqual([]);
    expect(listPerms).toHaveBeenCalledWith(1);
  });

  it("super com grant → recebe a chave", async () => {
    listPerms.mockResolvedValue(["agentOS.console.view"]);
    const out = await SerializeUser(baseUser({ super: true }));
    expect(out.isInternalUser).toBe(true);
    expect(out.platformPermissions).toEqual(["agentOS.console.view"]);
  });

  it("profile=superadmin com grants", async () => {
    listPerms.mockResolvedValue(["agentOS.console.view"]);
    const out = await SerializeUser(
      baseUser({ super: false, profile: "superadmin" })
    );
    expect(out.isInternalUser).toBe(true);
    expect(out.platformPermissions).toEqual(["agentOS.console.view"]);
  });

  it("disabled não aparecem (service só lista enabled)", async () => {
    listPerms.mockResolvedValue(["agentOS.console.view"]);
    const out = await SerializeUser(baseUser({ super: true }));
    expect(out.platformPermissions).not.toContain("agentOS.console.manage");
  });

  it("supportMode preserva identidade e permissões", async () => {
    listPerms.mockResolvedValue(["agentOS.console.view"]);
    const user = baseUser({ super: true, companyId: 1 });
    // serializeUserForSession com outra empresa — mock Company.findByPk
    const Company = require("../../models/Company").default;
    Company.findByPk.mockResolvedValue({
      id: 99,
      name: "Tenant",
      dueDate: null,
      timezone: null,
      businessSegment: null,
      crmVisibilityMode: null,
      unassignedTicketsQueueId: null
    });

    const out = await serializeUserForSession(user, 99);
    expect(out.isInternalUser).toBe(true);
    expect(out.platformPermissions).toEqual(["agentOS.console.view"]);
    expect(out.supportMode).toBe(true);
    expect(out).not.toHaveProperty("jwt");
    expect(out).not.toHaveProperty("passwordHash");
  });
});
