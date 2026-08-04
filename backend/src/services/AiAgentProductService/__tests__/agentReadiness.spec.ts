import {
  computeAiAgentProductReadiness,
  AiAgentProductSnapshot,
  resolveAiAgentProductMode,
  technicalModeToCommercial
} from "../AgentReadinessService";
import {
  serializeAiAgentProductSummary,
  serializeAiAgentReadiness,
  serializeUnavailableProductSummary,
  AI_AGENT_PRODUCT_SUMMARY_ALLOWED_KEYS
} from "../serializeAiAgentProduct";
import {
  AiAgentProductSummary,
  AGENT_PRODUCT_STATUS_PRIORITY
} from "../../../types/aiAgentProduct";
import GetAiAgentProductSummaryService, {
  GetAiAgentProductReadinessService
} from "../GetAiAgentProductSummaryService";

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findAll: jest.fn().mockResolvedValue([]) }
}));
jest.mock("../../../models/AiAgentProfile", () => ({
  __esModule: true,
  default: { findAll: jest.fn().mockResolvedValue([]) }
}));
jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: { findOne: jest.fn().mockResolvedValue(null) }
}));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: jest.fn().mockResolvedValue([]) }
}));
jest.mock("../../../middleware/loadCompanyEffectiveFeatures", () => ({
  loadCompanyPlanContextByCompanyId: jest.fn()
}));

import AiAgent from "../../../models/AiAgent";
import Whatsapp from "../../../models/Whatsapp";
import { loadCompanyPlanContextByCompanyId } from "../../../middleware/loadCompanyEffectiveFeatures";

function baseSnapshot(
  partial: Partial<AiAgentProductSnapshot> &
    Pick<AiAgentProductSnapshot, "agents" | "connections">
): AiAgentProductSnapshot {
  return {
    enabledByPlan: true,
    accessibleByUser: true,
    ...partial
  };
}

const completeAgent = {
  id: 1,
  name: "Bot",
  enabled: true,
  hasProvider: true,
  hasInstructions: true,
  explicitlyPaused: false
};

const connectedWa = {
  id: 9,
  name: "WA",
  status: "CONNECTED",
  aiAgentId: 1,
  runtimeMode: "disabled" as const
};

describe("hardening 2.0.1 — AgentReadinessService", () => {
  it("plano off → unavailable", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        enabledByPlan: false,
        agents: [completeAgent],
        connections: [connectedWa]
      })
    );
    expect(readiness.status).toBe("unavailable");
    expect(readiness.nextAction).toBe("upgrade_plan");
    expect(AGENT_PRODUCT_STATUS_PRIORITY.unavailable).toBeLessThan(
      AGENT_PRODUCT_STATUS_PRIORITY.not_created
    );
  });

  it("nenhum agente → not_created", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({ agents: [], connections: [] })
    );
    expect(readiness.status).toBe("not_created");
  });

  it("incompleto → setup_incomplete", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [{ ...completeAgent, hasProvider: false }],
        connections: [connectedWa]
      })
    );
    expect(readiness.status).toBe("setup_incomplete");
    expect(readiness.nextAction).toBe("configure_provider");
  });

  it("completo nunca ativado (enabled=false) → ready_to_activate, NÃO paused", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [{ ...completeAgent, enabled: false }],
        connections: [connectedWa]
      })
    );
    expect(readiness.status).toBe("ready_to_activate");
    expect(readiness.mode).toBe("off");
    expect(readiness.ready).toBe(true);
    expect(readiness.nextAction).toBe("activate_shadow");
  });

  it("completo enabled + modo off → ready_to_activate", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [completeAgent],
        connections: [connectedWa]
      })
    );
    expect(readiness.status).toBe("ready_to_activate");
  });

  it("shadow técnico → active / mode shadow", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [completeAgent],
        connections: [{ ...connectedWa, runtimeMode: "shadow" }]
      })
    );
    expect(readiness.status).toBe("active");
    expect(readiness.mode).toBe("shadow");
  });

  it("dry_run → mode shadow comercial (legado observacional)", () => {
    expect(technicalModeToCommercial("dry_run")).toBe("shadow");
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [completeAgent],
        connections: [{ ...connectedWa, runtimeMode: "dry_run" }]
      })
    );
    expect(readiness.mode).toBe("shadow");
    expect(readiness.status).toBe("active");
  });

  it("live → active", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [completeAgent],
        connections: [{ ...connectedWa, runtimeMode: "live" }]
      })
    );
    expect(readiness.mode).toBe("live");
    expect(readiness.status).toBe("active");
  });

  it("paused só com explicitlyPaused", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [{ ...completeAgent, explicitlyPaused: true }],
        connections: [connectedWa]
      })
    );
    expect(readiness.status).toBe("paused");
    expect(readiness.mode).toBe("paused");
    expect(readiness.nextAction).toBe("resume_agent");
  });

  it("live + conexão inativa → attention_required", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [completeAgent],
        connections: [
          {
            ...connectedWa,
            status: "DISCONNECTED",
            runtimeMode: "live"
          }
        ]
      })
    );
    expect(readiness.status).toBe("attention_required");
  });

  it("enabled=false + mode live na conexão → ready_to_activate (modo preservado)", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [{ ...completeAgent, enabled: false }],
        connections: [{ ...connectedWa, runtimeMode: "live" }]
      })
    );
    expect(readiness.status).toBe("ready_to_activate");
    expect(readiness.mode).toBe("live");
    expect(readiness.nextAction).toBe("activate_live");
    expect(readiness.ready).toBe(true);
  });

  it("enabled=false + mode shadow → nextAction activate_shadow", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [{ ...completeAgent, enabled: false }],
        connections: [{ ...connectedWa, runtimeMode: "shadow" }]
      })
    );
    expect(readiness.status).toBe("ready_to_activate");
    expect(readiness.mode).toBe("shadow");
    expect(readiness.nextAction).toBe("activate_shadow");
  });

  it("enabled=false + mode live + conexão desconectada → ainda ready (não attention)", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [{ ...completeAgent, enabled: false }],
        connections: [
          {
            ...connectedWa,
            status: "DISCONNECTED",
            runtimeMode: "live"
          }
        ]
      })
    );
    expect(readiness.status).toBe("ready_to_activate");
    expect(readiness.mode).toBe("live");
  });

  it("prioridade: unavailable vence agentes existentes", () => {
    const a = computeAiAgentProductReadiness(
      baseSnapshot({
        enabledByPlan: false,
        agents: [completeAgent],
        connections: [{ ...connectedWa, runtimeMode: "live" }]
      })
    );
    expect(a.readiness.status).toBe("unavailable");
  });

  it("prioridade: setup_incomplete vence live na conexão se provider falta", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [{ ...completeAgent, hasProvider: false }],
        connections: [{ ...connectedWa, runtimeMode: "live" }]
      })
    );
    expect(readiness.status).toBe("setup_incomplete");
  });

  it("prioridade: attention vence active quando desconectado", () => {
    const { readiness } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [completeAgent],
        connections: [
          { ...connectedWa, status: "OPENING", runtimeMode: "shadow" }
        ]
      })
    );
    expect(readiness.status).toBe("attention_required");
    expect(AGENT_PRODUCT_STATUS_PRIORITY.attention_required).toBeLessThan(
      AGENT_PRODUCT_STATUS_PRIORITY.active
    );
  });

  it("live prevalece sobre shadow no mode", () => {
    const mode = resolveAiAgentProductMode({
      agent: completeAgent,
      linkedConnections: [
        { ...connectedWa, id: 1, runtimeMode: "shadow" },
        { ...connectedWa, id: 2, runtimeMode: "live" }
      ]
    });
    expect(mode).toBe("live");
  });

  it("determinístico: duas chamadas idênticas", () => {
    const snap = baseSnapshot({
      agents: [completeAgent],
      connections: [{ ...connectedWa, runtimeMode: "shadow" }]
    });
    const a = computeAiAgentProductReadiness(snap);
    const b = computeAiAgentProductReadiness(snap);
    expect(a.readiness).toEqual(b.readiness);
  });
});

describe("hardening 2.0.1 — serializer allowlist", () => {
  it("somente chaves permitidas", () => {
    const out = serializeAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "active",
      mode: "shadow",
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
        mode: "shadow",
        nextAction: "none",
        checks: [
          {
            key: "plan",
            status: "complete",
            labelKey: "aiAgentProduct.checks.plan"
          }
        ]
      }
    });
    expect(Object.keys(out).sort()).toEqual(
      [...AI_AGENT_PRODUCT_SUMMARY_ALLOWED_KEYS].sort()
    );
    const json = JSON.stringify(out);
    for (const bad of [
      "apiKey",
      "apiKeyMasked",
      "credentialId",
      "systemPrompt",
      "prompt",
      "providerCredential",
      "trace",
      "metadata",
      "execution",
      "planning",
      "policy",
      "token",
      "secret",
      "companyId"
    ]) {
      expect(json.toLowerCase()).not.toContain(bad.toLowerCase());
    }
  });

  it("unavailable reduzido sem agente/conexão", () => {
    const out = serializeUnavailableProductSummary({
      enabledByPlan: false,
      accessibleByUser: false
    });
    expect(out.status).toBe("unavailable");
    expect(out.agent).toEqual({ exists: false });
    expect(out.connection).toEqual({ linked: false });
    expect(out.readiness.checks).toHaveLength(1);
  });

  it("descarta campos extras na entrada", () => {
    const out = serializeAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "not_created",
      mode: "off",
      agent: { exists: false },
      connection: { linked: false },
      connectionScope: {
        type: "all_linked",
        count: 0,
        connectedCount: 0,
        disconnectedCount: 0,
        names: []
      },
      agentScope: { type: "none", count: 0 },
      readiness: {
        ready: false,
        status: "not_created",
        mode: "off",
        nextAction: "create_agent",
        checks: [],
        apiKey: "x",
        companyId: 99
      } as AiAgentProductSummary["readiness"] & {
        apiKey?: string;
        companyId?: number;
      }
    } as unknown as AiAgentProductSummary);
    expect(JSON.stringify(out)).not.toMatch(/apiKey|companyId|99/);
    expect(serializeAiAgentReadiness(out.readiness).ready).toBe(false);
  });
});

describe("hardening 2.0.1 — tenant isolation no snapshot", () => {
  it("conexões de outro agentId não ativam o agente A", () => {
    const { readiness, linkedConnections } = computeAiAgentProductReadiness(
      baseSnapshot({
        agents: [completeAgent],
        connections: [
          {
            id: 1,
            name: "WA-B",
            status: "CONNECTED",
            aiAgentId: 999,
            runtimeMode: "live"
          }
        ]
      })
    );
    expect(linkedConnections).toHaveLength(0);
    expect(readiness.status).toBe("setup_incomplete");
    expect(readiness.nextAction).toBe("connect_whatsapp");
  });
});

describe("hardening 2.0.1 — summary vs readiness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadCompanyPlanContextByCompanyId as jest.Mock).mockResolvedValue({
      featureMap: { "automation.ai_agent": true }
    });
    (AiAgent.findAll as jest.Mock).mockResolvedValue([]);
    (Whatsapp.findAll as jest.Mock).mockResolvedValue([]);
  });

  it("readiness deriva do mesmo summary (status/mode/ready/nextAction)", async () => {
    const summary = await GetAiAgentProductSummaryService({
      companyId: 10,
      availability: { enabledByPlan: true, accessibleByUser: true }
    });
    const readiness = await GetAiAgentProductReadinessService({
      companyId: 10,
      availability: { enabledByPlan: true, accessibleByUser: true }
    });

    expect(readiness.status).toBe(summary.status);
    expect(readiness.mode).toBe(summary.mode);
    expect(readiness.readiness).toEqual(summary.readiness);
    expect(readiness.availability).toEqual(summary.availability);
  });

  it("plano off → unavailable sem consultar detalhes sensíveis demais", async () => {
    const summary = await GetAiAgentProductSummaryService({
      companyId: 10,
      availability: { enabledByPlan: false, accessibleByUser: false }
    });
    expect(summary.status).toBe("unavailable");
    expect(summary.agent.exists).toBe(false);
    expect(AiAgent.findAll).not.toHaveBeenCalled();
  });

  it("user feature off → 403", async () => {
    await expect(
      GetAiAgentProductSummaryService({
        companyId: 10,
        availability: { enabledByPlan: true, accessibleByUser: false }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
      statusCode: 403
    });
  });
});
