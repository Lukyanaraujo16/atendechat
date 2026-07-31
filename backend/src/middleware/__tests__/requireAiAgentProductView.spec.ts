import requireAiAgentProductView from "../requireAiAgentProductView";
import AppError from "../../errors/AppError";

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

import User from "../../models/User";

function run(user: Record<string, unknown> | undefined) {
  return new Promise<{ err?: any }>(resolve => {
    const req = { user } as any;
    const res = {} as any;
    Promise.resolve(requireAiAgentProductView(req, res, (err?: any) => resolve({ err }))).catch(
      (err: any) => resolve({ err })
    );
  });
}

describe("requireAiAgentProductView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("admin → next()", async () => {
    const { err } = await run({ id: 1, profile: "admin", companyId: 1 });
    expect(err).toBeUndefined();
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("supervisor → 403", async () => {
    const { err } = await run({ id: 2, profile: "supervisor", companyId: 1 });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_AI_AGENT_PRODUCT_ACCESS_DENIED");
    expect(err.statusCode).toBe(403);
  });

  it("user comum → 403", async () => {
    const { err } = await run({ id: 3, profile: "user", companyId: 1 });
    expect(err.message).toBe("ERR_AI_AGENT_PRODUCT_ACCESS_DENIED");
  });

  it("supportMode sem Super Admin → 403", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 4,
      super: false,
      profile: "user"
    });
    const { err } = await run({
      id: 4,
      profile: "user",
      companyId: 2,
      supportMode: true
    });
    expect(err.message).toBe("ERR_AI_AGENT_PRODUCT_ACCESS_DENIED");
  });

  it("interno console-like sem admin → 403 (grant AgentOS irrelevante)", async () => {
    const { err } = await run({
      id: 5,
      profile: "user",
      companyId: 1,
      isInternalUser: true,
      platformPermissions: ["agentOS.console.view"]
    });
    expect(err.message).toBe("ERR_AI_AGENT_PRODUCT_ACCESS_DENIED");
  });

  it("admin em supportMode sem Super Admin → 403", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 6,
      super: false,
      profile: "admin"
    });
    const { err } = await run({
      id: 6,
      profile: "admin",
      companyId: 99,
      supportMode: true
    });
    expect(err.message).toBe("ERR_AI_AGENT_PRODUCT_ACCESS_DENIED");
  });

  it("Super Admin em supportMode → next()", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 7,
      super: true,
      profile: "admin"
    });
    const { err } = await run({
      id: 7,
      profile: "admin",
      companyId: 99,
      supportMode: true
    });
    expect(err).toBeUndefined();
    expect(User.findByPk).toHaveBeenCalledWith(7, {
      attributes: ["id", "super", "profile"]
    });
  });

  it("Super Admin em supportMode com profile não-admin → next()", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 8,
      super: true,
      profile: "user"
    });
    const { err } = await run({
      id: 8,
      profile: "user",
      companyId: 42,
      supportMode: true
    });
    expect(err).toBeUndefined();
  });
});
