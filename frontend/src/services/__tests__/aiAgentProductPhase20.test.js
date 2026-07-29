/**
 * Fase 2.0 — Product API client + mapper (atualizado 2.1 paths)
 */
import {
  AI_AGENT_PRODUCT_NEXT_ACTIONS,
  AI_AGENT_PRODUCT_STATUSES,
  mapAiAgentNextAction,
  mapAiAgentProductStatus,
  mapAiAgentProductSummary,
  normalizeAiAgentNextAction,
  normalizeAiAgentProductStatus,
} from "../../utils/aiAgentProductMapper";
import {
  getAiAgentProductReadiness,
  getAiAgentProductSummary,
} from "../aiAgentProductApi";
import api from "../api";
import { AI_AGENT_WIZARD_ROUTE_PATH } from "../../config/aiAgentFeature";

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("aiAgentProductMapper", () => {
  it("reconhece todos os statuses do contrato", () => {
    AI_AGENT_PRODUCT_STATUSES.forEach((status) => {
      expect(normalizeAiAgentProductStatus(status)).toBe(status);
      expect(mapAiAgentProductStatus(status).labelKey).toContain(status);
    });
  });

  it("status desconhecido cai em unavailable", () => {
    expect(normalizeAiAgentProductStatus("shadow_engine_hot")).toBe(
      "unavailable"
    );
  });

  it("reconhece todas as nextAction", () => {
    AI_AGENT_PRODUCT_NEXT_ACTIONS.forEach((action) => {
      expect(normalizeAiAgentNextAction(action)).toBe(action);
      const mapped = mapAiAgentNextAction(action);
      expect(mapped.type).toBe(action);
      expect(mapped.labelKey).toContain(action);
    });
  });

  it("nextAction desconhecida → none", () => {
    expect(mapAiAgentNextAction("hack_the_planet").type).toBe("none");
  });

  it("não recalcula readiness — usa ready do backend", () => {
    const view = mapAiAgentProductSummary({
      status: "setup_incomplete",
      mode: "off",
      availability: { enabledByPlan: true, accessibleByUser: true },
      readiness: {
        ready: false,
        status: "setup_incomplete",
        nextAction: "configure_provider",
        checks: [{ key: "provider", status: "pending", labelKey: "x" }],
      },
      agent: { exists: true, id: 1, name: "A", enabled: true },
      connection: { linked: false },
    });
    expect(view.ready).toBe(false);
    expect(view.status).toBe("setup_incomplete");
    expect(view.nextAction.type).toBe("configure_provider");
    expect(view.nextAction.path).toContain(AI_AGENT_WIZARD_ROUTE_PATH);
    expect(view.checks).toHaveLength(1);
  });

  it("não decide ready a partir de checks ou enabled", () => {
    const view = mapAiAgentProductSummary({
      status: "ready_to_activate",
      mode: "off",
      agent: { exists: true, enabled: false },
      readiness: {
        ready: true,
        status: "ready_to_activate",
        nextAction: "activate_shadow",
        checks: [
          { key: "mode", status: "pending", labelKey: "m" },
          { key: "provider", status: "complete", labelKey: "p" },
        ],
      },
    });
    expect(view.ready).toBe(true);
    expect(view.agent.enabled).toBe(false);
    expect(view.nextAction.enabled).toBe(false);
  });
});

describe("aiAgentProductApi", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("summary chama Product API (não /automation)", async () => {
    api.get.mockResolvedValue({ data: { status: "not_created" } });
    await getAiAgentProductSummary();
    expect(api.get).toHaveBeenCalledWith("/product/ai-agent/summary");
    const url = api.get.mock.calls[0][0];
    expect(url).not.toMatch(/\/automation\//);
    expect(url).not.toMatch(/technical-console/);
  });

  it("readiness chama Product API", async () => {
    api.get.mockResolvedValue({ data: {} });
    await getAiAgentProductReadiness();
    expect(api.get).toHaveBeenCalledWith("/product/ai-agent/readiness");
  });
});
