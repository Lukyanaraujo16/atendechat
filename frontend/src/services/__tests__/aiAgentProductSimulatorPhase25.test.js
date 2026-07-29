/**
 * Fase 2.5 — Product Simulator comercial (client + mapper + bootstrap).
 */
import {
  AI_AGENT_SIMULATOR_ROUTE_PATH,
  AI_AGENT_SIMULATOR_LEGACY_ROUTE_PATH,
  AI_AGENT_SIMULATOR_CANONICAL_ROUTE_PATH,
} from "../../config/aiAgentFeature";
import { buildAiAgentSecondaryActions } from "../../utils/aiAgentProductMapper";
import {
  getAiAgentProductSimulator,
  createAiAgentProductSimulatorSession,
  getAiAgentProductSimulatorSession,
  sendAiAgentProductSimulatorMessage,
  endAiAgentProductSimulatorSession,
  reviewAiAgentProductSimulatorMessage,
} from "../aiAgentProductApi";
import api from "../api";

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe("Fase 2.5 — rotas canônicas", () => {
  it("rota canônica sem agentId", () => {
    expect(AI_AGENT_SIMULATOR_ROUTE_PATH).toBe("/ai-agent/simulator");
    expect(AI_AGENT_SIMULATOR_CANONICAL_ROUTE_PATH).toBe(
      "/ai-agent/simulator"
    );
    expect(AI_AGENT_SIMULATOR_LEGACY_ROUTE_PATH).toBe(
      "/ai-agent/:agentId/simulator"
    );
  });

  it("mapper open_simulator usa path canônico", () => {
    const actions = buildAiAgentSecondaryActions({
      agent: { exists: true, id: 99 },
      agentScope: { type: "single", count: 1 },
    });
    const sim = actions.find((a) => a.id === "open_simulator");
    expect(sim.path).toBe("/ai-agent/simulator");
    expect(sim.path).not.toContain("99");
  });

  it("mapper inclui simulator mesmo sem agentId (página explica unavailable)", () => {
    const actions = buildAiAgentSecondaryActions({
      agent: { exists: false },
      agentScope: { type: "none", count: 0 },
    });
    expect(actions.some((a) => a.id === "open_simulator")).toBe(true);
  });
});

describe("Fase 2.5 — Product Simulator API client anti-legado", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it("bootstrap chama /product/ai-agent/simulator", async () => {
    api.get.mockResolvedValue({
      data: {
        available: true,
        reason: null,
        agentScope: { type: "single", count: 1 },
        agent: { name: "Bot", description: null, status: "ready_to_activate", mode: "off" },
        capabilities: { canSimulate: true, canReview: true },
        provider: { label: "OpenAI", modelLabel: "gpt-4o-mini" },
        scenarioSegment: "retail",
        sessions: [],
      },
    });
    const data = await getAiAgentProductSimulator();
    expect(api.get).toHaveBeenCalledWith("/product/ai-agent/simulator");
    const url = api.get.mock.calls[0][0];
    expect(url).not.toMatch(/\/ai-agents\//);
    expect(url).not.toMatch(/agentId/);
    expect(data.scenarioSegment).toBe("retail");
    expect(data.capabilities.canSimulate).toBe(true);
  });

  it("create/get/send/end/review usam refs e Product namespace", async () => {
    api.post.mockResolvedValueOnce({
      data: { ref: "sim_s_1", status: "active", messages: [] },
    });
    api.get.mockResolvedValueOnce({
      data: {
        ref: "sim_s_1",
        status: "active",
        messages: [{ ref: "sim_m_1", role: "assistant", content: "Oi" }],
      },
    });
    api.post.mockResolvedValueOnce({
      data: {
        userMessage: { ref: "sim_m_2", role: "user", content: "Olá" },
        assistantMessage: { ref: "sim_m_3", role: "assistant", content: "Oi" },
        session: { ref: "sim_s_1", messageCount: 2 },
      },
    });
    api.post.mockResolvedValueOnce({
      data: { ref: "sim_s_1", status: "ended", endedAt: null },
    });
    api.post.mockResolvedValueOnce({
      data: { rating: "good", tags: [], note: null, reviewedAt: null },
    });

    await createAiAgentProductSimulatorSession();
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/simulator/sessions"
    );

    await getAiAgentProductSimulatorSession("sim_s_1");
    expect(api.get).toHaveBeenCalledWith(
      "/product/ai-agent/simulator/sessions/sim_s_1"
    );

    const send = await sendAiAgentProductSimulatorMessage("sim_s_1", "Olá");
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/simulator/sessions/sim_s_1/messages",
      { content: "Olá" }
    );
    expect(send).not.toHaveProperty("functionCalling");
    expect(JSON.stringify(api.post.mock.calls)).not.toMatch(/functionCalling/);

    await endAiAgentProductSimulatorSession("sim_s_1");
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/simulator/sessions/sim_s_1/end"
    );

    await reviewAiAgentProductSimulatorMessage("sim_m_3", {
      rating: "good",
    });
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/simulator/messages/sim_m_3/review",
      { rating: "good" }
    );

    const allUrls = [...api.get.mock.calls, ...api.post.mock.calls].map(
      (c) => c[0]
    );
    allUrls.forEach((url) => {
      expect(url).toMatch(/^\/product\/ai-agent\/simulator/);
      expect(url).not.toMatch(/\/ai-agents\//);
    });
  });

  it("bootstrap unavailable mapping preserva reason comercial", async () => {
    api.get.mockResolvedValue({
      data: {
        available: false,
        reason: "credential_not_selected",
        agentScope: { type: "single", count: 1 },
        agent: { name: "Bot", description: null, status: "setup_incomplete", mode: "off" },
        capabilities: { canSimulate: false, canReview: false },
        provider: { label: null, modelLabel: null },
        scenarioSegment: null,
        sessions: [],
      },
    });
    const data = await getAiAgentProductSimulator();
    expect(data.available).toBe(false);
    expect(data.reason).toBe("credential_not_selected");
    expect(data.capabilities.canSimulate).toBe(false);
  });
});
