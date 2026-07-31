import {
  canManageAiAgentProductSync,
  resolveAiAgentProductManageAccess
} from "../canManageAiAgentProduct";

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

import User from "../../models/User";

describe("canManageAiAgentProduct", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("admin tenant autorizado", () => {
    expect(
      canManageAiAgentProductSync({ id: 1, profile: "admin", companyId: 10 } as any)
    ).toBe(true);
  });

  it("supervisor não autorizado", () => {
    expect(
      canManageAiAgentProductSync({
        id: 2,
        profile: "supervisor",
        companyId: 10
      } as any)
    ).toBe(false);
  });

  it("user comum não autorizado", () => {
    expect(
      canManageAiAgentProductSync({ id: 3, profile: "user", companyId: 10 } as any)
    ).toBe(false);
  });

  it("supportMode sem super → negado", () => {
    expect(
      canManageAiAgentProductSync(
        { id: 4, profile: "admin", supportMode: true } as any,
        false
      )
    ).toBe(false);
  });

  it("supportMode com super → autorizado", () => {
    expect(
      canManageAiAgentProductSync(
        { id: 5, profile: "admin", supportMode: true } as any,
        true
      )
    ).toBe(true);
  });

  it("resolveAiAgentProductManageAccess confirma Super no banco", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 9,
      super: true,
      profile: "admin"
    });
    const out = await resolveAiAgentProductManageAccess({
      id: 9,
      profile: "admin",
      supportMode: true
    });
    expect(out).toEqual({
      allowed: true,
      isSupportMutation: true,
      isSuper: true
    });
  });

  it("resolveAiAgentProductManageAccess bloqueia supportMode sem Super", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 10,
      super: false,
      profile: "admin"
    });
    const out = await resolveAiAgentProductManageAccess({
      id: 10,
      profile: "admin",
      supportMode: true
    });
    expect(out.allowed).toBe(false);
    expect(out.isSupportMutation).toBe(true);
  });

  it("Super Admin fora do suporte não opera tenant arbitrário via supportMode", async () => {
    const out = await resolveAiAgentProductManageAccess({
      id: 11,
      profile: "admin",
      supportMode: false,
      super: true
    });
    expect(out.allowed).toBe(true);
    expect(out.isSupportMutation).toBe(false);
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});
