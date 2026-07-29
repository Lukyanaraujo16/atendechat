import requireAiAgentProductView from "../requireAiAgentProductView";
import AppError from "../../errors/AppError";

function run(user: Record<string, unknown> | undefined) {
  return new Promise<{ err?: any }>(resolve => {
    const req = { user } as any;
    const res = {} as any;
    requireAiAgentProductView(req, res, (err?: any) => resolve({ err }));
  });
}

describe("requireAiAgentProductView", () => {
  it("admin → next()", async () => {
    const { err } = await run({ id: 1, profile: "admin", companyId: 1 });
    expect(err).toBeUndefined();
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

  it("supportMode sem profile admin → 403", async () => {
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

  it("admin em supportMode → next() (contexto tenant; feature no service)", async () => {
    const { err } = await run({
      id: 6,
      profile: "admin",
      companyId: 99,
      supportMode: true
    });
    expect(err).toBeUndefined();
  });
});
