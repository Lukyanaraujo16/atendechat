/**
 * Fase 2.9C — Commands, Simulator e Connections agent-scoped.
 */
import {
  partitionAiAgentProductConnections,
  aiAgentConnectionConflictMessage,
} from "../../utils/aiAgentProductConnections";
import {
  buildAiAgentSecondaryActions,
  mapAiAgentNextAction,
  mapAiAgentProductSummary,
} from "../../utils/aiAgentProductMapper";
import {
  AI_AGENT_ROUTE_PATH,
  aiAgentPath,
  aiAgentSimulatorPath,
} from "../../config/aiAgentFeature";
import { postAiAgentProductCommand } from "../aiAgentProductApi";

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const api = require("../api").default;

describe("Fase 2.9C — Commands agent-scoped", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("command com agentRef usa rota explícita /agents/:agentRef/commands", async () => {
    api.post.mockResolvedValue({
      data: {
        command: "activate_shadow",
        changed: true,
        summary: { status: "active", mode: "shadow" },
      },
    });
    await postAiAgentProductCommand("activate_shadow", "ref-a");
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/agents/ref-a/commands",
      { command: "activate_shadow" }
    );
    expect(api.post.mock.calls[0][0]).not.toBe("/product/ai-agent/commands");
  });

  it("command sem agentRef não inventa agente (rota flat sem body agentRef)", async () => {
    api.post.mockResolvedValue({ data: { command: "deactivate", changed: false } });
    await postAiAgentProductCommand("deactivate");
    expect(api.post).toHaveBeenCalledWith("/product/ai-agent/commands", {
      command: "deactivate",
    });
  });

  it("summary com agentRef explícito isola secondary actions no agente A", () => {
    const viewA = mapAiAgentProductSummary(
      {
        status: "active",
        mode: "shadow",
        agentScope: { type: "single", count: 1 },
        agent: { exists: true, id: 1, agentRef: "1", name: "Comercial" },
        readiness: {
          ready: true,
          status: "active",
          nextAction: "none",
          checks: [],
        },
      },
      { agentRef: "1" }
    );
    const viewB = mapAiAgentProductSummary(
      {
        status: "setup_incomplete",
        mode: "off",
        agentScope: { type: "single", count: 1 },
        agent: { exists: true, id: 2, agentRef: "2", name: "Financeiro" },
        readiness: {
          ready: false,
          status: "setup_incomplete",
          nextAction: "fix_connection",
          checks: [],
        },
      },
      { agentRef: "2" }
    );

    expect(viewA.agent.agentRef).toBe("1");
    expect(viewB.agent.agentRef).toBe("2");
    expect(
      viewA.secondaryActions.find((a) => a.id === "open_simulator")?.path
    ).toBe(aiAgentSimulatorPath("1"));
    expect(
      viewB.secondaryActions.find((a) => a.id === "open_simulator")?.path
    ).toBe(aiAgentSimulatorPath("2"));
    expect(viewB.nextAction.action).toBe("manage_connections");
    expect(viewA.status).toBe("active");
    expect(viewB.status).toBe("setup_incomplete");
  });
});

describe("Fase 2.9C — Simulator identidade", () => {
  it("paths agent-scoped e bare hub", () => {
    expect(aiAgentSimulatorPath("ref-a")).toBe("/ai-agent/ref-a/simulator");
    expect(aiAgentPath("ref-a")).toBe("/ai-agent/ref-a");
    expect(AI_AGENT_ROUTE_PATH).toBe("/ai-agent");
  });

  it("sem agentRef secondary simulator não inventa primeiro agente", () => {
    const actions = buildAiAgentSecondaryActions({
      agentScope: { type: "ambiguous", count: 2 },
      agent: { exists: true, id: 99 },
    });
    expect(actions.find((a) => a.id === "open_simulator")?.path).toBe(
      AI_AGENT_ROUTE_PATH
    );
    expect(actions.find((a) => a.id === "open_simulator")?.enabled).toBe(false);
  });
});

describe("Fase 2.9C — Connections buckets e conflito", () => {
  it("particiona linked / available / other", () => {
    const buckets = partitionAiAgentProductConnections([
      { ref: "1", name: "WA1", selected: true, eligible: true },
      { ref: "2", name: "WA2", selected: false, eligible: true },
      {
        ref: "3",
        name: "WA3",
        selected: false,
        eligible: false,
        ineligibleReason: "already_assigned",
        assignedAgentName: "Financeiro",
      },
    ]);
    expect(buckets.linked.map((c) => c.ref)).toEqual(["1"]);
    expect(buckets.available.map((c) => c.ref)).toEqual(["2"]);
    expect(buckets.other.map((c) => c.ref)).toEqual(["3"]);
  });

  it("conflito menciona agente detentor sem transferência silenciosa", () => {
    const msg = aiAgentConnectionConflictMessage({
      assignedAgentName: "Financeiro",
    });
    expect(msg.key).toBe("aiAgentProduct.connections.conflictWithAgent");
    expect(msg.params.name).toBe("Financeiro");
  });

  it("PUT connections usa path agent-scoped", async () => {
    api.put.mockResolvedValue({ data: { ok: true } });
    const { putAiAgentProductConnections } = jest.requireActual(
      "../aiAgentProductApi"
    );
    await putAiAgentProductConnections({ connectionRefs: ["1"] }, "ref-a");
    expect(api.put).toHaveBeenCalledWith(
      "/product/ai-agent/agents/ref-a/configuration/connections",
      { connectionRefs: ["1"] }
    );
  });
});

describe("Fase 2.9C — fluxo multiagente contrato", () => {
  it("Hub paths e create não dependem de singleton", () => {
    expect(mapAiAgentNextAction("create_agent").path).toBe("/ai-agent/new");
    const commercial = mapAiAgentProductSummary(
      {
        status: "ready_to_activate",
        mode: "off",
        agent: { exists: true, agentRef: "10", name: "Comercial" },
        readiness: {
          ready: true,
          status: "ready_to_activate",
          nextAction: "activate_shadow",
          checks: [],
        },
      },
      { agentRef: "10" }
    );
    const finance = mapAiAgentProductSummary(
      {
        status: "ready_to_activate",
        mode: "off",
        agent: { exists: true, agentRef: "20", name: "Financeiro" },
        readiness: {
          ready: true,
          status: "ready_to_activate",
          nextAction: "activate_live",
          checks: [],
        },
      },
      { agentRef: "20" }
    );
    expect(commercial.nextAction.command).toBe("activate_shadow");
    expect(finance.nextAction.command).toBe("activate_live");
    expect(commercial.agent.agentRef).not.toBe(finance.agent.agentRef);
  });
});
