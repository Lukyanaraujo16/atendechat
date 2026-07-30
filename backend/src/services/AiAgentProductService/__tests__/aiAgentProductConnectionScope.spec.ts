import {
  buildAiAgentProductConnectionScope,
  buildAffectedConnections,
  hasMixedConnectionModes,
  resolveAffectedFromMode,
  sortConnectionsByIdAsc
} from "../aiAgentProductConnectionScope";
import { computeAiAgentProductReadiness } from "../AgentReadinessService";
import {
  serializeAiAgentProductCommandResult,
  serializeAiAgentProductSummary
} from "../serializeAiAgentProduct";
import ExecuteAiAgentProductCommandService from "../ExecuteAiAgentProductCommandService";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: (t: unknown) => Promise<void>) => {
      await cb({});
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

function mockSingleAgent(agent: any): void {
  mockAgentFindAll.mockResolvedValue([agent]);
  mockAgentFindOne.mockResolvedValue(agent);
}

function completeSnapshot(connections: any[]) {
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
    connections
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

describe("aiAgentProductConnectionScope helpers", () => {
  it("ordena por id ASC de forma determinística", () => {
    const sorted = sortConnectionsByIdAsc([
      { id: 30, name: "C" },
      { id: 10, name: "A" },
      { id: 20, name: "B" }
    ]);
    expect(sorted.map(c => c.id)).toEqual([10, 20, 30]);
  });

  it("monta connectionScope comercial sem ids", () => {
    const scope = buildAiAgentProductConnectionScope([
      { id: 2, name: "Sec", status: "DISCONNECTED" },
      { id: 1, name: "Pri", status: "CONNECTED" }
    ]);
    expect(scope).toEqual({
      type: "all_linked",
      count: 2,
      connectedCount: 1,
      disconnectedCount: 1,
      names: ["Pri", "Sec"]
    });
    expect(JSON.stringify(scope)).not.toMatch(/"id"|companyId|session/i);
  });

  it("detecta estado misto e fromMode mixed", () => {
    expect(
      hasMixedConnectionModes([
        { runtimeMode: "live" },
        { runtimeMode: "shadow" }
      ])
    ).toBe(true);
    expect(
      resolveAffectedFromMode([
        { runtimeMode: "live" },
        { runtimeMode: "shadow" }
      ])
    ).toBe("mixed");
  });
});

describe("summary determinístico e mixed → attention", () => {
  it("escolhe primary CONNECTED com menor id", () => {
    const { primaryConnection, linkedConnections, readiness } =
      computeAiAgentProductReadiness(
        completeSnapshot([
          {
            id: 20,
            name: "B",
            status: "CONNECTED",
            aiAgentId: 1,
            runtimeMode: "disabled"
          },
          {
            id: 10,
            name: "A",
            status: "CONNECTED",
            aiAgentId: 1,
            runtimeMode: "disabled"
          }
        ])
      );
    expect(linkedConnections.map(c => c.id)).toEqual([10, 20]);
    expect(primaryConnection?.id).toBe(10);
    expect(readiness.status).toBe("ready_to_activate");
  });

  it("estado misto live+shadow → attention_required", () => {
    const { readiness } = computeAiAgentProductReadiness(
      completeSnapshot([
        {
          id: 1,
          name: "A",
          status: "CONNECTED",
          aiAgentId: 1,
          runtimeMode: "live"
        },
        {
          id: 2,
          name: "B",
          status: "CONNECTED",
          aiAgentId: 1,
          runtimeMode: "shadow"
        }
      ])
    );
    expect(readiness.status).toBe("attention_required");
    expect(readiness.mode).toBe("live");
  });

  it("serializer inclui connectionScope allowlist", () => {
    const out = serializeAiAgentProductSummary(summaryPayload() as any);
    expect(out.connectionScope.count).toBe(1);
    expect(out).not.toHaveProperty("whatsappId");
  });
});

describe("ExecuteAiAgentProductCommandService — escopo Opção A", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true
    });
    mockSnapshot.mockResolvedValue(
      completeSnapshot([
        {
          id: 9,
          name: "WA",
          status: "CONNECTED",
          aiAgentId: 1,
          runtimeMode: "disabled"
        }
      ])
    );
    mockSummary.mockResolvedValue(summaryPayload());
  });

  it("duas conexões CONNECTED → activate_live em ambas", async () => {
    const agent = makeAgent({ enabled: false });
    const waA = makeWa({ id: 1, name: "A", aiAgentMode: "disabled" });
    const waB = makeWa({ id: 2, name: "B", aiAgentMode: "disabled" });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([waB, waA]); // ordem invertida; service ordena

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: { user: { profile: "admin", companyId: 10 } } as any,
      body: { command: "activate_live" }
    });

    expect(waA.update).toHaveBeenCalledWith(
      expect.objectContaining({ aiAgentMode: "live" }),
      expect.any(Object)
    );
    expect(waB.update).toHaveBeenCalledWith(
      expect.objectContaining({ aiAgentMode: "live" }),
      expect.any(Object)
    );
    expect(result.affectedConnections).toEqual(
      expect.objectContaining({
        scope: "all_linked",
        count: 2,
        names: ["A", "B"],
        toMode: "live"
      })
    );
    expect(mockWaFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 10, aiAgentId: 1 },
        order: [["id", "ASC"]]
      })
    );
  });

  it("uma CONNECTED + uma DISCONNECTED → falha total (sem update)", async () => {
    const agent = makeAgent({ enabled: true });
    const waOk = makeWa({ id: 1, name: "Ok", status: "CONNECTED" });
    const waBad = makeWa({
      id: 2,
      name: "Bad",
      status: "DISCONNECTED",
      aiAgentMode: "disabled"
    });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([waOk, waBad]);

    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: { user: { profile: "admin", companyId: 10 } } as any,
        body: { command: "activate_shadow" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_CONNECTION_UNAVAILABLE"
    });
    expect(waOk.update).not.toHaveBeenCalled();
    expect(waBad.update).not.toHaveBeenCalled();
  });

  it("estado misto sob activate_live → changed true e normaliza", async () => {
    const agent = makeAgent({ enabled: true });
    const waLive = makeWa({
      id: 1,
      name: "A",
      aiAgentMode: "live",
      aiAgentEnabled: true
    });
    const waShadow = makeWa({
      id: 2,
      name: "B",
      aiAgentMode: "shadow",
      aiAgentEnabled: true
    });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([waLive, waShadow]);

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: { user: { profile: "admin", companyId: 10 } } as any,
      body: { command: "activate_live" }
    });

    expect(result.changed).toBe(true);
    expect(result.affectedConnections.fromMode).toBe("mixed");
    expect(waShadow.update).toHaveBeenCalledWith(
      expect.objectContaining({ aiAgentMode: "live" }),
      expect.any(Object)
    );
  });

  it("deactivate desliga todas mesmo desconectadas", async () => {
    const agent = makeAgent({ enabled: true });
    const waA = makeWa({
      id: 1,
      aiAgentMode: "live",
      aiAgentEnabled: true,
      status: "CONNECTED"
    });
    const waB = makeWa({
      id: 2,
      aiAgentMode: "shadow",
      aiAgentEnabled: true,
      status: "DISCONNECTED"
    });
    mockSingleAgent(agent);
    mockWaFindAll.mockResolvedValue([waA, waB]);

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: { user: { profile: "admin", companyId: 10 } } as any,
      body: { command: "deactivate" }
    });

    expect(agent.update).toHaveBeenCalledWith(
      { enabled: false },
      expect.any(Object)
    );
    expect(waA.update).toHaveBeenCalled();
    expect(waB.update).toHaveBeenCalled();
    expect(result.affectedConnections.toMode).toBe("off");
  });

  it("cross-tenant: where sempre usa companyId da sessão", async () => {
    mockAgentFindAll.mockResolvedValue([]);
    const result = await ExecuteAiAgentProductCommandService({
      companyId: 77,
      req: { user: { profile: "admin", companyId: 77 } } as any,
      body: { command: "deactivate" }
    });
    expect(result.changed).toBe(false);
    expect(mockAgentFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 77 },
        order: [["id", "ASC"]]
      })
    );
  });

  it("comando result serializer inclui affectedConnections", () => {
    const out = serializeAiAgentProductCommandResult({
      command: "activate_live",
      changed: true,
      affectedConnections: buildAffectedConnections({
        linked: [{ id: 1, name: "X", status: "CONNECTED" }],
        fromMode: "off",
        toMode: "live"
      }),
      summary: summaryPayload() as any
    });
    expect(out.affectedConnections.count).toBe(1);
    expect(JSON.stringify(out)).not.toMatch(/systemPrompt|apiKey|companyId/i);
  });
});
