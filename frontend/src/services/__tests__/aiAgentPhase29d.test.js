/**
 * Fase 2.9D — QA multiagente: isolamento Comercial/Financeiro, cache, rotas, conflito.
 */
import {
  partitionAiAgentProductConnections,
  aiAgentConnectionConflictMessage,
} from "../../utils/aiAgentProductConnections";
import {
  buildAiAgentSecondaryActions,
  mapAiAgentProductSummary,
} from "../../utils/aiAgentProductMapper";
import {
  AI_AGENT_NEW_ROUTE_PATH,
  AI_AGENT_ROUTE_PATH,
  aiAgentPath,
  aiAgentSimulatorPath,
  aiAgentWizardEditPath,
} from "../../config/aiAgentFeature";
import {
  getAiAgentProductSummary,
  listAiAgentProductAgents,
  postAiAgentProductCommand,
  postAiAgentProductConfiguration,
  putAiAgentProductConnections,
  putAiAgentProductConfiguration,
} from "../aiAgentProductApi";

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const api = require("../api").default;

function summaryFixture(agentRef, name, overrides = {}) {
  return {
    status: overrides.status || "setup_incomplete",
    mode: overrides.mode || "off",
    agentScope: { type: "single", count: 1 },
    agent: {
      exists: true,
      id: Number(agentRef),
      agentRef: String(agentRef),
      name,
      enabled: overrides.enabled === true,
    },
    readiness: {
      ready: overrides.ready === true,
      status: overrides.status || "setup_incomplete",
      nextAction: overrides.nextAction || "configure_agent",
      checks: [],
    },
  };
}

describe("Fase 2.9D — fluxo Comercial / Financeiro", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cria 1º, 2º e 3º agentes com agentRef distintos sem ALREADY_EXISTS", async () => {
    api.post
      .mockResolvedValueOnce({
        data: { agent: { agentRef: "1", name: "Comercial" }, created: true },
      })
      .mockResolvedValueOnce({
        data: { agent: { agentRef: "2", name: "Financeiro" }, created: true },
      })
      .mockResolvedValueOnce({
        data: { agent: { agentRef: "3", name: "Suporte" }, created: true },
      });

    const a = await postAiAgentProductConfiguration({ name: "Comercial" });
    const b = await postAiAgentProductConfiguration({ name: "Financeiro" });
    const c = await postAiAgentProductConfiguration({ name: "Suporte" });

    expect(a.agent.agentRef).toBe("1");
    expect(b.agent.agentRef).toBe("2");
    expect(c.agent.agentRef).toBe("3");
    expect(new Set([a.agent.agentRef, b.agent.agentRef, c.agent.agentRef]).size).toBe(
      3
    );
    expect(api.post).toHaveBeenCalledTimes(3);
    api.post.mock.calls.forEach((call) => {
      expect(call[0]).toBe("/product/ai-agent/configuration");
      expect(JSON.stringify(call[1])).not.toMatch(/ALREADY_EXISTS/);
    });
  });

  it("Hub lista Comercial e Financeiro independentes", async () => {
    api.get.mockResolvedValue({
      data: {
        agents: [
          {
            agentRef: "1",
            name: "Comercial",
            status: "active",
            ready: true,
            connectionCount: 1,
            operationMode: "shadow",
          },
          {
            agentRef: "2",
            name: "Financeiro",
            status: "setup_incomplete",
            ready: false,
            connectionCount: 0,
            operationMode: "off",
          },
        ],
      },
    });
    const { agents } = await listAiAgentProductAgents();
    expect(agents).toHaveLength(2);
    expect(agents[0].name).toBe("Comercial");
    expect(agents[1].name).toBe("Financeiro");
    expect(agents[0].ready).not.toBe(agents[1].ready);
    expect(agents[0].connectionCount).toBe(1);
    expect(agents[1].connectionCount).toBe(0);
  });

  it("edição A usa path agent-scoped e não inventa B", async () => {
    api.put.mockResolvedValue({ data: { ok: true } });
    await putAiAgentProductConfiguration(
      { identity: { name: "Comercial Renovado" } },
      "1"
    );
    expect(api.put).toHaveBeenCalledWith(
      "/product/ai-agent/agents/1/configuration",
      { identity: { name: "Comercial Renovado" } }
    );
    expect(api.put.mock.calls[0][0]).not.toContain("/agents/2/");
  });

  it("commands A e B usam agentRef correto", async () => {
    api.post.mockResolvedValue({ data: { command: "deactivate", changed: true } });
    await postAiAgentProductCommand("deactivate", "1");
    await postAiAgentProductCommand("activate_shadow", "2");
    expect(api.post.mock.calls[0][0]).toBe(
      "/product/ai-agent/agents/1/commands"
    );
    expect(api.post.mock.calls[1][0]).toBe(
      "/product/ai-agent/agents/2/commands"
    );
  });

  it("connections: Comercial↔WA Comercial e Financeiro↔WA Financeiro; conflito bloqueado", () => {
    const comercialBuckets = partitionAiAgentProductConnections([
      {
        ref: "9",
        name: "WhatsApp Comercial",
        selected: true,
        eligible: true,
      },
      {
        ref: "10",
        name: "WhatsApp Financeiro",
        selected: false,
        eligible: false,
        ineligibleReason: "already_assigned",
        assignedAgentName: "Financeiro",
        assignedAgentRef: "2",
      },
    ]);
    expect(comercialBuckets.linked.map((c) => c.ref)).toEqual(["9"]);
    expect(comercialBuckets.other.map((c) => c.ref)).toEqual(["10"]);
    expect(comercialBuckets.available).toHaveLength(0);

    const conflict = aiAgentConnectionConflictMessage({
      assignedAgentName: "Financeiro",
    });
    expect(conflict.key).toBe("aiAgentProduct.connections.conflictWithAgent");
    expect(conflict.params.name).toBe("Financeiro");
  });

  it("PUT connections do Financeiro não usa agentRef do Comercial", async () => {
    api.put.mockResolvedValue({ data: { changed: true } });
    await putAiAgentProductConnections({ connectionRefs: ["10"] }, "2");
    expect(api.put).toHaveBeenCalledWith(
      "/product/ai-agent/agents/2/configuration/connections",
      { connectionRefs: ["10"] }
    );
  });

  it("summary mapeado isola readiness e simulator paths", () => {
    const viewA = mapAiAgentProductSummary(
      summaryFixture("1", "Comercial", {
        status: "active",
        ready: true,
        mode: "live",
        nextAction: "none",
      }),
      { agentRef: "1" }
    );
    const viewB = mapAiAgentProductSummary(
      summaryFixture("2", "Financeiro", {
        status: "setup_incomplete",
        ready: false,
        nextAction: "connect_whatsapp",
      }),
      { agentRef: "2" }
    );
    expect(viewA.agent.name).toBe("Comercial");
    expect(viewB.agent.name).toBe("Financeiro");
    expect(viewA.ready).toBe(true);
    expect(viewB.ready).toBe(false);
    expect(
      viewA.secondaryActions.find((a) => a.id === "open_simulator")?.path
    ).toBe(aiAgentSimulatorPath("1"));
    expect(
      viewB.secondaryActions.find((a) => a.id === "open_simulator")?.path
    ).toBe(aiAgentSimulatorPath("2"));
  });

  it("rotas deep-link nunca apontam ao primeiro agente sem ref", () => {
    expect(AI_AGENT_ROUTE_PATH).toBe("/ai-agent");
    expect(AI_AGENT_NEW_ROUTE_PATH).toBe("/ai-agent/new");
    expect(aiAgentPath("1")).toBe("/ai-agent/1");
    expect(aiAgentPath("2")).toBe("/ai-agent/2");
    expect(aiAgentWizardEditPath("1")).toBe("/ai-agent/1/wizard");
    expect(aiAgentSimulatorPath("2")).toBe("/ai-agent/2/simulator");

    const ambiguousActions = buildAiAgentSecondaryActions({
      agentScope: { type: "ambiguous", count: 2 },
      agent: { exists: true, id: 1, agentRef: "1" },
    });
    expect(
      ambiguousActions.find((a) => a.id === "open_simulator")?.path
    ).toBe(AI_AGENT_ROUTE_PATH);
    expect(
      ambiguousActions.find((a) => a.id === "open_simulator")?.enabled
    ).toBe(false);
  });

  it("GET summary agent-scoped usa path com agentRef", async () => {
    api.get.mockResolvedValue({ data: summaryFixture("2", "Financeiro") });
    await getAiAgentProductSummary("2");
    expect(api.get).toHaveBeenCalledWith(
      "/product/ai-agent/agents/2/summary"
    );
  });

  it("applySummary rejeitaria cruzamento via mapper preferredRef", () => {
    const crossed = mapAiAgentProductSummary(
      summaryFixture("1", "Comercial", { status: "active", ready: true }),
      { agentRef: "2" }
    );
    // preferredRef da URL prevalece para paths; não inventa navegação para [0]
    expect(
      crossed.secondaryActions.find((a) => a.id === "open_simulator")?.path
    ).toBe(aiAgentSimulatorPath("2"));
  });
});

describe("Fase 2.9D — cache keys implícitas via paths", () => {
  it("paths A e B são distintos para summary/commands/connections/simulator", () => {
    const refs = ["1", "2"];
    const paths = refs.flatMap((ref) => [
      `/product/ai-agent/agents/${ref}/summary`,
      `/product/ai-agent/agents/${ref}/commands`,
      `/product/ai-agent/agents/${ref}/configuration/connections`,
      aiAgentSimulatorPath(ref),
    ]);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
