/**
 * Fase 2.10 — configuração completa + navegação Product.
 */
import {
  AI_AGENT_ROUTE_PATH,
  aiAgentPath,
  aiAgentSectionPath,
  parseAiAgentDetailSection,
} from "../../config/aiAgentFeature";
import { buildAiAgentSecondaryActions } from "../../utils/aiAgentProductMapper";
import {
  getAiAgentProductKnowledge,
  putAiAgentProductKnowledge,
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

describe("Fase 2.10 — rotas e seções", () => {
  it("section paths usam agentRef explícito", () => {
    expect(aiAgentSectionPath("1", "overview")).toBe("/ai-agent/1");
    expect(aiAgentSectionPath("1", "identity")).toBe("/ai-agent/1/identity");
    expect(aiAgentSectionPath("1", "intelligence")).toBe(
      "/ai-agent/1/intelligence"
    );
    expect(aiAgentSectionPath("1", "knowledge")).toBe("/ai-agent/1/knowledge");
    expect(aiAgentSectionPath("1", "connections")).toBe(
      "/ai-agent/1/connections"
    );
    expect(aiAgentSectionPath("1", "tests")).toBe("/ai-agent/1/simulator");
    expect(aiAgentSectionPath("1", "settings")).toBe("/ai-agent/1/settings");
  });

  it("parseAiAgentDetailSection não inventa primeiro agente", () => {
    expect(parseAiAgentDetailSection("/ai-agent")).toEqual({
      agentRef: "",
      section: "overview",
    });
    expect(parseAiAgentDetailSection("/ai-agent/42/intelligence")).toEqual({
      agentRef: "42",
      section: "intelligence",
    });
    expect(parseAiAgentDetailSection("/ai-agent/new")).toEqual({
      agentRef: "",
      section: "overview",
    });
  });
});

describe("Fase 2.10 — secondary actions comerciais", () => {
  it("oferece identidade, inteligência e conhecimento agent-scoped", () => {
    const actions = buildAiAgentSecondaryActions(
      {
        agentScope: { type: "single", count: 1 },
        agent: { exists: true, agentRef: "7", id: 7 },
      },
      { agentRef: "7" }
    );
    expect(actions.find((a) => a.id === "edit_identity")?.path).toBe(
      "/ai-agent/7/identity"
    );
    expect(actions.find((a) => a.id === "edit_intelligence")?.path).toBe(
      "/ai-agent/7/intelligence"
    );
    expect(actions.find((a) => a.id === "edit_knowledge")?.path).toBe(
      "/ai-agent/7/knowledge"
    );
    expect(actions.find((a) => a.id === "open_wizard")).toBeUndefined();
    expect(actions.find((a) => a.id === "manage_connections")?.path).toBe(
      "/ai-agent/7/connections"
    );
  });

  it("ambiguous não aponta para primeiro agente", () => {
    const actions = buildAiAgentSecondaryActions({
      agentScope: { type: "ambiguous", count: 2 },
      agent: { exists: true, id: 1, agentRef: "1" },
    });
    expect(actions.find((a) => a.id === "edit_intelligence")?.enabled).toBe(
      false
    );
    expect(actions.find((a) => a.id === "edit_intelligence")?.path).toBe(
      AI_AGENT_ROUTE_PATH
    );
  });
});

describe("Fase 2.10 — Product API knowledge e config", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("knowledge GET/PUT usam agentRef", async () => {
    api.get.mockResolvedValue({ data: { links: [], availableBases: [] } });
    api.put.mockResolvedValue({ data: { changed: true, links: [] } });
    await getAiAgentProductKnowledge("9");
    await putAiAgentProductKnowledge({ knowledgeBaseRefs: ["3"] }, "9");
    expect(api.get).toHaveBeenCalledWith("/product/ai-agent/agents/9/knowledge");
    expect(api.put).toHaveBeenCalledWith(
      "/product/ai-agent/agents/9/knowledge",
      { knowledgeBaseRefs: ["3"] }
    );
  });

  it("PUT configuration A não usa path de B", async () => {
    api.put.mockResolvedValue({ data: { ok: true } });
    await putAiAgentProductConfiguration(
      { name: "Comercial", customInstructions: "venda" },
      "1"
    );
    expect(api.put.mock.calls[0][0]).toBe(
      "/product/ai-agent/agents/1/configuration"
    );
    expect(api.put.mock.calls[0][0]).not.toContain("/agents/2/");
  });

  it("aiAgentPath permanece estável", () => {
    expect(aiAgentPath("abc")).toBe("/ai-agent/abc");
  });
});
