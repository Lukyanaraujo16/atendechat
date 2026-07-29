/**
 * Fase 2.2 — comandos comerciais Product API (Experience Layer)
 */
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import AiAgentExperiencePage from "../../components/AiAgentExperiencePage";
import AiAgentPrimaryAction from "../../components/AiAgentPrimaryAction";
import {
  buildAiAgentCommercialCommands,
  getAiAgentCommandConfirmKeys,
  isDeferredMutationAction,
  isProductMutationCommand,
  mapAiAgentNextAction,
  mapAiAgentProductSummary,
} from "../../utils/aiAgentProductMapper";
import {
  getAiAgentProductSummary,
  postAiAgentProductCommand,
} from "../aiAgentProductApi";
import api from "../api";

jest.mock("../api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key) => key,
  },
}));

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

function readySummary(overrides = {}) {
  return mapAiAgentProductSummary({
    availability: { enabledByPlan: true, accessibleByUser: true },
    status: "ready_to_activate",
    mode: "off",
    agent: { exists: true, id: 3, name: "Bot", enabled: false },
    connection: { linked: true, name: "WA", connected: true },
    readiness: {
      ready: true,
      status: "ready_to_activate",
      mode: "off",
      nextAction: "activate_shadow",
      checks: [
        { key: "plan", status: "complete", labelKey: "aiAgentProduct.checks.plan" },
        {
          key: "connection",
          status: "complete",
          labelKey: "aiAgentProduct.checks.connection",
        },
      ],
    },
    ...overrides,
  });
}

describe("Fase 2.2 — mapper commands", () => {
  it("activate_shadow / activate_live habilitam command Product API", () => {
    ["activate_shadow", "activate_live"].forEach((type) => {
      expect(isProductMutationCommand(type)).toBe(true);
      expect(isDeferredMutationAction(type)).toBe(false);
      const action = mapAiAgentNextAction(type, { agentId: 9 });
      expect(action.enabled).toBe(true);
      expect(action.command).toBe(type);
      expect(action.path).toBeNull();
      expect(action.requiresConfirmation).toBe(true);
    });
  });

  it("resume_agent permanece seguro/desabilitado", () => {
    expect(isDeferredMutationAction("resume_agent")).toBe(true);
    const action = mapAiAgentNextAction("resume_agent", { agentId: 1 });
    expect(action.enabled).toBe(false);
    expect(action.command).toBeNull();
  });

  it("ready_to_activate oferece activate_live como comando extra", () => {
    const view = readySummary();
    expect(view.nextAction.command).toBe("activate_shadow");
    const cmds = buildAiAgentCommercialCommands(view);
    expect(cmds.some((c) => c.command === "activate_live")).toBe(true);
    expect(cmds.some((c) => c.command === "activate_shadow")).toBe(false);
  });

  it("active shadow oferece live + deactivate (não shadow)", () => {
    const view = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "active",
      mode: "shadow",
      agent: { exists: true, id: 1, name: "A", enabled: true },
      connection: { linked: true, name: "WA", connected: true },
      readiness: {
        ready: true,
        status: "active",
        mode: "shadow",
        nextAction: "none",
        checks: [],
      },
    });
    const cmds = view.commercialCommands.map((c) => c.command);
    expect(cmds).toContain("activate_live");
    expect(cmds).toContain("deactivate");
    expect(cmds).not.toContain("activate_shadow");
  });

  it("unavailable não oferece comandos de ativação", () => {
    const view = mapAiAgentProductSummary({
      availability: { enabledByPlan: false, accessibleByUser: false },
      status: "unavailable",
      mode: "off",
      readiness: {
        ready: false,
        status: "unavailable",
        mode: "off",
        nextAction: "upgrade_plan",
        checks: [],
      },
    });
    expect(view.commercialCommands).toHaveLength(0);
  });

  it("confirmações têm body explicativo (não só 'tem certeza')", () => {
    ["activate_shadow", "activate_live", "deactivate"].forEach((cmd) => {
      const keys = getAiAgentCommandConfirmKeys(cmd);
      expect(keys.bodyKey).toContain(cmd);
      expect(keys.titleKey).toContain(cmd);
    });
  });

  it("ação desconhecida permanece segura", () => {
    expect(mapAiAgentNextAction("explode").type).toBe("none");
    expect(getAiAgentCommandConfirmKeys("explode").titleKey).toContain(
      "unknown"
    );
  });
});

describe("Fase 2.2 — API client", () => {
  it("postAiAgentProductCommand usa namespace product", async () => {
    api.post.mockResolvedValue({ data: { command: "activate_live", changed: true } });
    await postAiAgentProductCommand("activate_live");
    expect(api.post).toHaveBeenCalledWith("/product/ai-agent/commands", {
      command: "activate_live",
    });
    expect(api.post.mock.calls[0][0]).not.toMatch(/automation|ai-agents/);
  });

  it("summary continua em product namespace", async () => {
    api.get.mockResolvedValue({ data: {} });
    await getAiAgentProductSummary();
    expect(api.get).toHaveBeenCalledWith("/product/ai-agent/summary");
  });
});

describe("Fase 2.2 — PrimaryAction confirmação + busy", () => {
  it("abre confirmação e chama onCommand sem path legado", async () => {
    const onCommand = jest.fn().mockResolvedValue(undefined);
    const action = mapAiAgentNextAction("activate_shadow");
    render(
      <MemoryRouter>
        <AiAgentPrimaryAction nextAction={action} onCommand={onCommand} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId("ai-agent-primary-action"));
    expect(
      screen.getByText("aiAgentProduct.confirm.activate_shadow.body")
    ).toBeTruthy();
    fireEvent.click(
      screen.getByText("aiAgentProduct.confirm.activate_shadow.confirm")
    );
    expect(onCommand).toHaveBeenCalledWith("activate_shadow");
  });

  it("busy desabilita botão principal", () => {
    const action = mapAiAgentNextAction("activate_live");
    render(
      <MemoryRouter>
        <AiAgentPrimaryAction
          nextAction={action}
          onCommand={jest.fn()}
          commandBusy
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-primary-action").disabled).toBe(true);
  });
});

describe("Fase 2.2 — Experience page command wiring", () => {
  it("exibe botão deactivate quando active/live", () => {
    const summary = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "active",
      mode: "live",
      agent: { exists: true, id: 2, name: "Bot", enabled: true },
      connection: { linked: true, name: "WA", connected: true },
      readiness: {
        ready: true,
        status: "active",
        mode: "live",
        nextAction: "none",
        checks: [],
      },
    });
    render(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summary}
          onRetry={() => {}}
          onCommand={jest.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-command-deactivate")).toBeTruthy();
    expect(screen.getByTestId("ai-agent-command-activate_shadow")).toBeTruthy();
  });

  it("feature off (unavailable) não passa onCommand efetivo de ativação", () => {
    const summary = mapAiAgentProductSummary({
      availability: { enabledByPlan: false, accessibleByUser: false },
      status: "unavailable",
      mode: "off",
      readiness: {
        ready: false,
        status: "unavailable",
        nextAction: "upgrade_plan",
        checks: [],
      },
    });
    render(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summary}
          onRetry={() => {}}
          onCommand={jest.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("ai-agent-command-activate_live")).toBeNull();
    expect(screen.queryByTestId("ai-agent-command-deactivate")).toBeNull();
  });

  it("mostra erro de comando e retry de página", () => {
    const onRetry = jest.fn();
    render(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={readySummary()}
          onRetry={onRetry}
          onCommand={jest.fn()}
          commandError="aiAgentProduct.commandErrors.notReady"
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-command-error").textContent).toContain(
      "notReady"
    );
  });
});

describe("Fase 2.2 — sem optimistic mode no mapper de resposta", () => {
  it("apply path usa summary do backend (mode vem do payload)", () => {
    const before = readySummary();
    expect(before.mode).toBe("off");
    const after = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "active",
      mode: "live",
      agent: { exists: true, id: 3, name: "Bot", enabled: true },
      connection: { linked: true, name: "WA", connected: true },
      readiness: {
        ready: true,
        status: "active",
        mode: "live",
        nextAction: "none",
        checks: [],
      },
    });
    expect(after.mode).toBe("live");
    expect(after.status).toBe("active");
  });
});
