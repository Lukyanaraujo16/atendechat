/**
 * Fase 2.9B — Product Hub multiagente (listagem, rotas, agentRef).
 */
import React from "react";
import { MemoryRouter, Route, Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import { render, screen, fireEvent } from "@testing-library/react";
import AiAgentHubPage from "../../components/AiAgentHubPage";
import AiAgentCard from "../../components/AiAgentCard";
import {
  AI_AGENT_NEW_ROUTE_PATH,
  AI_AGENT_ROUTE_PATH,
  aiAgentPath,
  aiAgentWizardEditPath,
  aiAgentSimulatorPath,
} from "../../config/aiAgentFeature";
import { listAiAgentProductAgents } from "../aiAgentProductApi";
import {
  buildAiAgentSecondaryActions,
  mapAiAgentNextAction,
  mapAiAgentProductSummary,
} from "../../utils/aiAgentProductMapper";
import { validateWizardStep } from "../../components/AiAgentWizard/aiAgentWizardValidation";
import { createDefaultWizardFormState } from "../../components/AiAgentWizard/aiAgentWizardDefaults";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key, opts) => {
      if (opts?.count != null) return `${key}:${opts.count}`;
      if (opts?.name != null) return `${key}:${opts.name}`;
      return key;
    },
  },
}));

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const api = require("../api").default;

function agentFixture(overrides = {}) {
  return {
    agentRef: "ref-a",
    name: "Agente Comercial",
    enabled: true,
    provider: "openai",
    model: "gpt-4o-mini",
    operationMode: "off",
    status: "setup_incomplete",
    ready: false,
    connectionCount: 1,
    ...overrides,
  };
}

function renderHub(ui, { route = "/ai-agent" } = {}) {
  const history = createMemoryHistory({ initialEntries: [route] });
  const view = render(<Router history={history}>{ui}</Router>);
  return { history, ...view };
}

describe("Fase 2.9B — Hub multiagente", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rotas canônicas usam agentRef string e /ai-agent/new", () => {
    expect(AI_AGENT_ROUTE_PATH).toBe("/ai-agent");
    expect(AI_AGENT_NEW_ROUTE_PATH).toBe("/ai-agent/new");
    expect(aiAgentPath("abc-1")).toBe("/ai-agent/abc-1");
    expect(aiAgentWizardEditPath("abc-1")).toBe("/ai-agent/abc-1/wizard");
    expect(aiAgentSimulatorPath("abc-1")).toBe("/ai-agent/abc-1/simulator");
    expect(aiAgentPath(null)).toBe("/ai-agent");
    expect(mapAiAgentNextAction("create_agent").path).toBe(
      AI_AGENT_NEW_ROUTE_PATH
    );
  });

  it("listAiAgentProductAgents preserva agentRef como string", async () => {
    api.get.mockResolvedValue({
      data: {
        agents: [
          {
            agentRef: "42",
            name: "Financeiro",
            enabled: false,
            connectionCount: 0,
          },
        ],
      },
    });
    const result = await listAiAgentProductAgents();
    expect(api.get).toHaveBeenCalledWith("/product/ai-agent/agents");
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].agentRef).toBe("42");
    expect(typeof result.agents[0].agentRef).toBe("string");
  });

  it("Hub vazio: CTA criar primeiro agente", () => {
    const { history } = renderHub(
      <AiAgentHubPage
        loading={false}
        error={null}
        agents={[]}
        onRetry={() => {}}
        canCreate
      />
    );

    expect(screen.getByTestId("ai-agent-hub-empty")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ai-agent-hub-create-first"));
    expect(history.location.pathname).toBe(AI_AGENT_NEW_ROUTE_PATH);
  });

  it("um agente: card + CTA Novo agente; gerenciar usa agentRef", () => {
    const agent = agentFixture();
    const { history } = renderHub(
      <AiAgentHubPage
        loading={false}
        error={null}
        agents={[agent]}
        onRetry={() => {}}
        canCreate
      />
    );

    expect(screen.getByTestId("ai-agent-card-ref-a")).toBeTruthy();
    expect(screen.getByTestId("ai-agent-hub-new-agent")).toBeTruthy();
    expect(screen.queryByTestId("ai-agent-ambiguous-notice")).toBeNull();
    fireEvent.click(screen.getByTestId("ai-agent-card-manage-ref-a"));
    expect(history.location.pathname).toBe("/ai-agent/ref-a");
  });

  it("múltiplos agentes: lista todos sem ambiguous; seleção por agentRef", () => {
    const agents = [
      agentFixture({ agentRef: "ref-a", name: "Comercial" }),
      agentFixture({
        agentRef: "ref-b",
        name: "Financeiro",
        status: "active",
        ready: true,
      }),
    ];

    const { history } = renderHub(
      <AiAgentHubPage
        loading={false}
        error={null}
        agents={agents}
        onRetry={() => {}}
        canCreate
      />
    );

    expect(screen.getByTestId("ai-agent-card-ref-a")).toBeTruthy();
    expect(screen.getByTestId("ai-agent-card-ref-b")).toBeTruthy();
    expect(screen.queryByTestId("ai-agent-ambiguous-notice")).toBeNull();
    fireEvent.click(screen.getByTestId("ai-agent-card-manage-ref-b"));
    expect(history.location.pathname).toBe("/ai-agent/ref-b");
  });

  it("erro do Hub não é interpretado como lista vazia", () => {
    renderHub(
      <AiAgentHubPage
        loading={false}
        error={new Error("network")}
        agents={[]}
        onRetry={() => {}}
        canCreate
      />
    );
    expect(screen.getByTestId("ai-agent-hub-error")).toBeTruthy();
    expect(screen.queryByTestId("ai-agent-hub-empty")).toBeNull();
  });

  it("loading evita flash do empty", () => {
    renderHub(
      <AiAgentHubPage
        loading
        error={null}
        agents={[]}
        onRetry={() => {}}
        canCreate
      />
    );
    expect(screen.getByTestId("ai-agent-hub-loading")).toBeTruthy();
    expect(screen.queryByTestId("ai-agent-hub-empty")).toBeNull();
  });

  it("CTA Novo agente oculto sem permissão", () => {
    renderHub(
      <AiAgentHubPage
        loading={false}
        error={null}
        agents={[agentFixture()]}
        onRetry={() => {}}
        canCreate={false}
      />
    );
    expect(screen.queryByTestId("ai-agent-hub-new-agent")).toBeNull();
  });

  it("card não exibe secrets nem agentRef como label", () => {
    render(
      <MemoryRouter>
        <AiAgentCard
          agent={agentFixture({
            name: "Suporte",
            apiKey: "sk-secret",
          })}
          onManage={() => {}}
          canManage
        />
      </MemoryRouter>
    );
    expect(screen.queryByText(/sk-secret/)).toBeNull();
    expect(screen.queryByText("ref-a")).toBeNull();
    expect(screen.getByText("Suporte")).toBeTruthy();
  });

  it("ambiguous legado no mapper aponta ao Hub (sem primeiro agente)", () => {
    const view = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "attention_required",
      mode: "off",
      agentScope: { type: "ambiguous", count: 2 },
      agent: { exists: true, id: 99, name: "Ignore" },
      readiness: {
        ready: false,
        status: "attention_required",
        nextAction: "configure_agent",
        checks: [],
      },
    });
    const secondary = buildAiAgentSecondaryActions(view);
    expect(secondary.find((a) => a.id === "edit_intelligence")?.path).toBe(
      AI_AGENT_ROUTE_PATH
    );
    expect(secondary.find((a) => a.id === "open_simulator")?.path).toBe(
      AI_AGENT_ROUTE_PATH
    );
  });

  it("deep-link path preserva agentRef na URL", () => {
    let matched = null;
    render(
      <MemoryRouter initialEntries={["/ai-agent/ref-deep"]}>
        <Route
          path="/ai-agent/:agentRef"
          render={({ match }) => {
            matched = match.params.agentRef;
            return <span data-testid="matched-ref">{matched}</span>;
          }}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("matched-ref").textContent).toBe("ref-deep");
    expect(matched).toBe("ref-deep");
  });

  it("create segundo agente: POST configuration e PUT edit usa agentRef", async () => {
    api.post.mockResolvedValue({
      data: { agentRef: "ref-new", summary: { agent: { agentRef: "ref-new" } } },
    });
    api.put.mockResolvedValue({
      data: { agentRef: "ref-a", summary: { agent: { agentRef: "ref-a" } } },
    });

    const { postAiAgentProductConfiguration, putAiAgentProductConfiguration } =
      jest.requireActual("../aiAgentProductApi");

    const created = await postAiAgentProductConfiguration({
      identity: { name: "Segundo" },
    });
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/configuration",
      expect.any(Object)
    );
    expect(String(created.agentRef)).toBe("ref-new");

    await putAiAgentProductConfiguration(
      { identity: { name: "Comercial" } },
      "ref-a"
    );
    expect(api.put).toHaveBeenCalledWith(
      "/product/ai-agent/agents/ref-a/configuration",
      { identity: { name: "Comercial" } }
    );
  });

  it("wizard exige identityName no create", () => {
    const errors = validateWizardStep("company", {
      ...createDefaultWizardFormState(),
      identityName: "   ",
      companyName: "Empresa",
      businessSegment: "clinic",
    });
    expect(errors.identityName).toBe("required");
  });
});
