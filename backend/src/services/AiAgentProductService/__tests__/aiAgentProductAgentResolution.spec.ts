import {
  resolveAiAgentProductAgentContext,
  resolveAiAgentProductAgentContextFromRows
} from "../ResolveAiAgentProductContextService";
import { computeAiAgentProductReadiness } from "../AgentReadinessService";
import { serializeAiAgentProductSummary } from "../serializeAiAgentProduct";
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

const agentA = {
  id: 1,
  name: "A",
  enabled: false,
  hasProvider: true,
  hasInstructions: true,
  explicitlyPaused: false
};

const agentB = {
  id: 2,
  name: "B",
  enabled: true,
  hasProvider: true,
  hasInstructions: true,
  explicitlyPaused: false
};

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

describe("ResolveAiAgentProductContextService (2.2.2)", () => {
  it("zero → not_created", () => {
    const r = resolveAiAgentProductAgentContext([]);
    expect(r.resolution).toBe("not_created");
    expect(r.agentScope).toEqual({ type: "none", count: 0 });
    expect(r.agent).toBeNull();
  });

  it("um agente (mesmo enabled=false) → resolved", () => {
    const r = resolveAiAgentProductAgentContext([agentA]);
    expect(r.resolution).toBe("resolved");
    expect(r.agent?.id).toBe(1);
    expect(r.agentScope.type).toBe("single");
  });

  it("dois agentes → ambiguous (não escolhe enabled)", () => {
    const r = resolveAiAgentProductAgentContext([agentA, agentB]);
    expect(r.resolution).toBe("ambiguous");
    expect(r.agent).toBeNull();
    expect(r.agentScope).toEqual({ type: "ambiguous", count: 2 });
  });

  it("fromRows idempotente sob lock", () => {
    const r = resolveAiAgentProductAgentContextFromRows([
      { id: 9, enabled: true },
      { id: 3, enabled: false }
    ]);
    expect(r.resolution).toBe("ambiguous");
    expect(r.candidatesCount).toBe(2);
  });
});

describe("readiness com resolução A", () => {
  it("dois agentes → attention_required sem nome aleatório", () => {
    const { readiness, agent, agentScope, resolution } =
      computeAiAgentProductReadiness({
        enabledByPlan: true,
        accessibleByUser: true,
        agents: [agentA, agentB],
        connections: [
          {
            id: 1,
            name: "WA",
            status: "CONNECTED",
            aiAgentId: 2,
            runtimeMode: "live"
          }
        ]
      });
    expect(resolution).toBe("ambiguous");
    expect(readiness.status).toBe("attention_required");
    expect(readiness.mode).toBe("off");
    expect(readiness.ready).toBe(false);
    expect(readiness.nextAction).toBe("configure_agent");
    expect(agent).toBeNull();
    expect(agentScope.type).toBe("ambiguous");
    expect(readiness.checks.find(c => c.key === "agent")?.status).toBe(
      "blocked"
    );
  });

  it("um agente enabled=false sem conexão → setup_incomplete / not silent primary", () => {
    const { readiness, agent, resolution } = computeAiAgentProductReadiness({
      enabledByPlan: true,
      accessibleByUser: true,
      agents: [agentA],
      connections: []
    });
    expect(resolution).toBe("resolved");
    expect(agent?.id).toBe(1);
    expect(readiness.status).toBe("setup_incomplete");
  });
});

describe("commands exigem agentRef com múltiplos agentes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true
    });
    mockSummary.mockResolvedValue(summaryPayload());
  });

  it("activate com 2 agentes sem agentRef → AGENT_REF_REQUIRED", async () => {
    mockSnapshot.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true,
      agents: [agentA, agentB],
      connections: []
    });
    mockAgentFindAll.mockResolvedValue([
      { id: 1, enabled: false, update: jest.fn() },
      { id: 2, enabled: true, update: jest.fn() }
    ]);

    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: { user: { profile: "admin", companyId: 10 } } as any,
        body: { command: "activate_live" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED"
    });
    expect(mockWaFindAll).not.toHaveBeenCalled();
  });

  it("deactivate com 2 agentes sem agentRef → AGENT_REF_REQUIRED", async () => {
    const a = { id: 1, enabled: true, update: jest.fn() };
    const b = { id: 2, enabled: true, update: jest.fn() };
    mockAgentFindAll.mockResolvedValue([a, b]);

    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: { user: { profile: "admin", companyId: 10 } } as any,
        body: { command: "deactivate" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED"
    });
    expect(a.update).not.toHaveBeenCalled();
    expect(b.update).not.toHaveBeenCalled();
  });

  it("activate sem agentes → CONTEXT_INVALID", async () => {
    mockSnapshot.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true,
      agents: [],
      connections: []
    });
    mockAgentFindAll.mockResolvedValue([]);

    await expect(
      ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: { user: { profile: "admin", companyId: 10 } } as any,
        body: { command: "activate_shadow" }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID"
    });
  });

  it("deactivate sem agentes → no-op seguro", async () => {
    mockAgentFindAll.mockResolvedValue([]);
    mockSummary.mockResolvedValue(
      summaryPayload({
        status: "not_created",
        mode: "off",
        agent: { exists: false },
        agentScope: { type: "none", count: 0 }
      })
    );

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: { user: { profile: "admin", companyId: 10 } } as any,
      body: { command: "deactivate" }
    });
    expect(result.changed).toBe(false);
  });

  it("um agente com várias conexões continua Operacional (regressão 2.2.1)", async () => {
    const agent = {
      id: 1,
      companyId: 10,
      enabled: false,
      update: jest.fn(async function (this: any, v: any) {
        Object.assign(this, v);
      })
    };
    const waA = {
      id: 1,
      name: "A",
      status: "CONNECTED",
      aiAgentId: 1,
      aiAgentMode: "disabled",
      aiAgentEnabled: false,
      update: jest.fn(async function (this: any, v: any) {
        Object.assign(this, v);
      })
    };
    const waB = {
      id: 2,
      name: "B",
      status: "CONNECTED",
      aiAgentId: 1,
      aiAgentMode: "disabled",
      aiAgentEnabled: false,
      update: jest.fn(async function (this: any, v: any) {
        Object.assign(this, v);
      })
    };
    mockSnapshot.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true,
      agents: [agentA],
      connections: [
        {
          id: 1,
          name: "A",
          status: "CONNECTED",
          aiAgentId: 1,
          runtimeMode: "disabled"
        },
        {
          id: 2,
          name: "B",
          status: "CONNECTED",
          aiAgentId: 1,
          runtimeMode: "disabled"
        }
      ]
    });
    mockAgentFindAll.mockResolvedValue([agent]);
    mockAgentFindOne.mockResolvedValue(agent);
    mockWaFindAll.mockResolvedValue([waA, waB]);

    const result = await ExecuteAiAgentProductCommandService({
      companyId: 10,
      req: { user: { profile: "admin", companyId: 10 } } as any,
      body: { command: "activate_shadow" }
    });
    expect(result.changed).toBe(true);
    expect(waA.update).toHaveBeenCalled();
    expect(waB.update).toHaveBeenCalled();
  });

  it("serializer ambíguo não inclui id/name de agente", () => {
    const out = serializeAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "attention_required",
      mode: "off",
      agent: { exists: true },
      connection: { linked: false },
      connectionScope: {
        type: "all_linked",
        count: 0,
        connectedCount: 0,
        disconnectedCount: 0,
        names: []
      },
      agentScope: { type: "ambiguous", count: 2 },
      readiness: {
        ready: false,
        status: "attention_required",
        mode: "off",
        nextAction: "configure_agent",
        checks: []
      }
    });
    expect(out.agentScope.type).toBe("ambiguous");
    expect(out.agent).toEqual({ exists: true });
    expect(out.agent).not.toHaveProperty("id");
    expect(out.agent).not.toHaveProperty("name");
  });

  it("tenant B não entra: where companyId da sessão", async () => {
    mockAgentFindAll.mockResolvedValue([]);
    await ExecuteAiAgentProductCommandService({
      companyId: 55,
      req: { user: { profile: "admin", companyId: 55 } } as any,
      body: { command: "deactivate" }
    });
    expect(mockAgentFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 55 } })
    );
  });
});
