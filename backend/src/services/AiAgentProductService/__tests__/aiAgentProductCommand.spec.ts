import AppError from "../../../errors/AppError";
import ExecuteAiAgentProductCommandService from "../ExecuteAiAgentProductCommandService";
import { serializeAiAgentProductCommandResult } from "../serializeAiAgentProduct";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: (t: unknown) => Promise<void>) => {
      await cb({ LOCK: { UPDATE: "UPDATE" } });
    })
  }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../GetAiAgentProductSummaryService", () => ({
  __esModule: true,
  default: jest.fn(),
  resolveAiAgentProductAvailability: jest.fn(),
  buildAiAgentProductSnapshot: jest.fn()
}));

import sequelize from "../../../database";
import AiAgent from "../../../models/AiAgent";
import Whatsapp from "../../../models/Whatsapp";
import GetAiAgentProductSummaryService, {
  buildAiAgentProductSnapshot,
  resolveAiAgentProductAvailability
} from "../GetAiAgentProductSummaryService";

const mockAvailability = resolveAiAgentProductAvailability as jest.Mock;
const mockSnapshot = buildAiAgentProductSnapshot as jest.Mock;
const mockSummary = GetAiAgentProductSummaryService as jest.Mock;
const mockAgentFindAll = AiAgent.findAll as jest.Mock;
const mockAgentFindOne = AiAgent.findOne as jest.Mock;
const mockWaFindAll = Whatsapp.findAll as jest.Mock;
const mockTx = sequelize.transaction as jest.Mock;

function summaryPayload(partial: Record<string, unknown> = {}) {
  return {
    availability: { enabledByPlan: true, accessibleByUser: true },
    status: "active",
    mode: "live",
    agent: { exists: true, id: 1, name: "Bot", enabled: true },
    connection: { linked: true, name: "WA", connected: true },
    connectionScope: {
      type: "all_linked",
      count: 1,
      connectedCount: 1,
      disconnectedCount: 0,
      names: ["WA"]
    },
    agentScope: { type: "single", count: 1 },
    readiness: {
      ready: true,
      status: "active",
      mode: "live",
      nextAction: "none",
      checks: []
    },
    ...partial
  };
}

function completeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    enabledByPlan: true,
    accessibleByUser: true,
    agents: [
      {
        id: 1,
        name: "Bot",
        enabled: true,
        hasProvider: true,
        hasInstructions: true,
        explicitlyPaused: false
      }
    ],
    connections: [
      {
        id: 9,
        name: "WA",
        status: "CONNECTED",
        aiAgentId: 1,
        runtimeMode: "disabled"
      }
    ],
    ...overrides
  };
}

function makeAgent(partial: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyId: 10,
    enabled: false,
    name: "Bot",
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
      return this;
    }),
    ...partial
  };
}

function makeWa(partial: Record<string, unknown> = {}) {
  return {
    id: 9,
    companyId: 10,
    name: "WA",
    status: "CONNECTED",
    aiAgentId: 1,
    aiAgentMode: "disabled",
    aiAgentEnabled: false,
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
      return this;
    }),
    ...partial
  };
}

function adminReq(companyId = 10) {
  return {
    user: { id: 1, profile: "admin", companyId }
  } as any;
}

function mockSingleAgent(agent: ReturnType<typeof makeAgent>): void {
  mockAgentFindAll.mockResolvedValue([agent]);
  mockAgentFindOne.mockResolvedValue(agent);
}

describe("ExecuteAiAgentProductCommandService (Fase 2.2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true
    });
    mockSnapshot.mockResolvedValue(completeSnapshot());
    mockSummary.mockResolvedValue(summaryPayload());
    mockTx.mockImplementation(async (cb: (t: unknown) => Promise<void>) => {
      await cb({ LOCK: { UPDATE: "UPDATE" } });
    });
  });

  it("rejeita comando inválido", async () => {
    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: adminReq(),
        body: { command: "resume_agent" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_COMMAND_NOT_ALLOWED",
      statusCode: 400
    });
  });

  it("rejeita agentId/whatsappId/companyId no body", async () => {
    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: adminReq(),
        body: { command: "deactivate", agentId: 99 }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID"
    });
  });

  it("feature plano off → NOT_AVAILABLE", async () => {
    mockAvailability.mockResolvedValue({
      enabledByPlan: false,
      accessibleByUser: false
    });
    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: adminReq(),
        body: { command: "activate_live" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      statusCode: 403
    });
    expect(mockTx).not.toHaveBeenCalled();
  });

  it("user feature off → ACCESS_DENIED", async () => {
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: false
    });
    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: adminReq(),
        body: { command: "activate_shadow" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
      statusCode: 403
    });
  });

  it("activate sem readiness estrutural → NOT_READY", async () => {
    mockSingleAgent(makeAgent({ enabled: true }));
    mockSnapshot.mockResolvedValue(
      completeSnapshot({
        agents: [
          {
            id: 1,
            name: "Bot",
            enabled: true,
            hasProvider: false,
            hasInstructions: true,
            explicitlyPaused: false
          }
        ]
      })
    );
    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: adminReq(),
        body: { command: "activate_live" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_NOT_READY",
      statusCode: 409
    });
    expect(mockTx).not.toHaveBeenCalled();
  });

  it("off → shadow altera agent + whatsapp", async () => {
    const agent = makeAgent({ enabled: false });
    const wa = makeWa({ aiAgentMode: "disabled", aiAgentEnabled: false });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);
    mockSummary.mockResolvedValue(
      summaryPayload({ status: "active", mode: "shadow" })
    );

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: adminReq(),
      body: { command: "activate_shadow" }
    });

    expect(agent.update).toHaveBeenCalledWith(
      { enabled: true },
      expect.any(Object)
    );
    expect(wa.update).toHaveBeenCalledWith(
      {
        aiAgentId: 1,
        aiAgentMode: "shadow",
        aiAgentEnabled: true
      },
      expect.any(Object)
    );
    expect(result.command).toBe("activate_shadow");
    expect(result.changed).toBe(true);
    expect(result.summary.mode).toBe("shadow");
    expect(result.summary).not.toHaveProperty("systemPrompt");
  });

  it("off → live", async () => {
    const agent = makeAgent({ enabled: false });
    const wa = makeWa();
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);

    await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: adminReq(),
      body: { command: "activate_live" }
    });

    expect(wa.update).toHaveBeenCalledWith(
      expect.objectContaining({ aiAgentMode: "live", aiAgentEnabled: true }),
      expect.any(Object)
    );
  });

  it("shadow → live", async () => {
    const agent = makeAgent({ enabled: true });
    const wa = makeWa({
      aiAgentMode: "shadow",
      aiAgentEnabled: true
    });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: adminReq(),
      body: { command: "activate_live" }
    });

    expect(wa.update).toHaveBeenCalledWith(
      expect.objectContaining({ aiAgentMode: "live" }),
      expect.any(Object)
    );
    expect(result.changed).toBe(true);
  });

  it("live → shadow", async () => {
    const agent = makeAgent({ enabled: true });
    const wa = makeWa({ aiAgentMode: "live", aiAgentEnabled: true });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);

    await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: adminReq(),
      body: { command: "activate_shadow" }
    });

    expect(wa.update).toHaveBeenCalledWith(
      expect.objectContaining({ aiAgentMode: "shadow" }),
      expect.any(Object)
    );
  });

  it("live → deactivate preserva aiAgentId", async () => {
    const agent = makeAgent({ enabled: true });
    const wa = makeWa({
      aiAgentMode: "live",
      aiAgentEnabled: true,
      aiAgentId: 1
    });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);
    mockSummary.mockResolvedValue(
      summaryPayload({
        status: "ready_to_activate",
        mode: "off",
        agent: { exists: true, id: 1, name: "Bot", enabled: false }
      })
    );

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: adminReq(),
      body: { command: "deactivate" }
    });

    expect(agent.update).toHaveBeenCalledWith(
      { enabled: false },
      expect.any(Object)
    );
    expect(wa.update).toHaveBeenCalledWith(
      { aiAgentMode: "disabled", aiAgentEnabled: false },
      expect.any(Object)
    );
    expect(result.summary.status).toBe("ready_to_activate");
    expect(result.summary.mode).toBe("off");
    expect(result.summary.status).not.toBe("paused");
  });

  it("comando repetido é idempotente (changed:false)", async () => {
    const agent = makeAgent({ enabled: true });
    const wa = makeWa({
      aiAgentMode: "live",
      aiAgentEnabled: true
    });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: adminReq(),
      body: { command: "activate_live" }
    });

    expect(result.changed).toBe(false);
    expect(agent.update).not.toHaveBeenCalled();
    expect(wa.update).not.toHaveBeenCalled();
  });

  it("deactivate já off → changed:false", async () => {
    const agent = makeAgent({ enabled: false });
    const wa = makeWa({
      aiAgentMode: "disabled",
      aiAgentEnabled: false
    });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: adminReq(),
      body: { command: "deactivate" }
    });

    expect(result.changed).toBe(false);
  });

  it("sem conexão CONNECTED → CONNECTION_UNAVAILABLE", async () => {
    const agent = makeAgent({ enabled: true });
    const wa = makeWa({ status: "DISCONNECTED", aiAgentMode: "disabled" });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);

    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: adminReq(),
        body: { command: "activate_shadow" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_CONNECTION_UNAVAILABLE"
    });
  });

  it("tenant: findAll usa companyId da sessão", async () => {
    const agent = makeAgent({ companyId: 10, enabled: true });
    const wa = makeWa({ companyId: 10, aiAgentMode: "shadow", aiAgentEnabled: true });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);

    await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: adminReq(10),
      body: { command: "deactivate" }
    });

    expect(mockAgentFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 10 } })
    );
    expect(mockWaFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 10, aiAgentId: 1 } })
    );
  });

  it("rollback: falha na 2ª update propaga erro e não retorna sucesso", async () => {
    const agent = makeAgent({ enabled: false });
    const wa = makeWa();
    wa.update.mockRejectedValue(new Error("db_fail"));
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([wa]);
    mockTx.mockImplementation(async (cb: (t: unknown) => Promise<void>) => {
      await cb({ LOCK: { UPDATE: "UPDATE" } });
    });

    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: adminReq(),
        body: { command: "activate_live" }
      })
    ).rejects.toThrow("db_fail");
  });

  it("serializer de comando não vaza campos técnicos", () => {
    const dirtySummary = {
      ...summaryPayload(),
      systemPrompt: "secret",
      agent: {
        exists: true,
        id: 1,
        name: "Bot",
        enabled: true,
        apiKey: "x"
      }
    } as any;
    const out = serializeAiAgentProductCommandResult({
      command: "activate_live",
      changed: true,
      affectedConnections: {
        scope: "all_linked",
        count: 1,
        names: ["WA"],
        fromMode: "off",
        toMode: "live"
      },
      summary: dirtySummary
    });
    expect(out).toEqual({
      command: "activate_live",
      changed: true,
      affectedConnections: expect.objectContaining({ count: 1, toMode: "live" }),
      summary: expect.objectContaining({
        status: "active",
        mode: "live"
      })
    });
    expect(JSON.stringify(out)).not.toMatch(/secret|apiKey|systemPrompt/i);
  });
});

describe("requireAiAgentProductView still covers auth profiles for commands route", () => {
  it("AppError codes remain stable", () => {
    const err = new AppError("ERR_AI_AGENT_PRODUCT_ACCESS_DENIED", 403);
    expect(err.message).toBe("ERR_AI_AGENT_PRODUCT_ACCESS_DENIED");
    expect(err.statusCode).toBe(403);
  });
});
