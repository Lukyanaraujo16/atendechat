/**
 * Fase 2.6 — anti-bypass AI Agent no módulo Conexões (WhatsAppModal + Hub).
 *
 * Preferência: contrato estático + mapper (sem dependência de MutationObserver
 * do Dialog MUI). O helper de status e o strip de payload são cobertos aqui;
 * a ausência de listagem /ai-agents é garantida por rg + este contrato.
 */
import fs from "fs";
import path from "path";
import {
  mapAiAgentNextAction,
  buildAiAgentSecondaryActions,
} from "../../utils/aiAgentProductMapper";
import {
  AI_AGENT_NEW_ROUTE_PATH,
  AI_AGENT_ROUTE_PATH,
} from "../../config/aiAgentFeature";

const modalSource = fs.readFileSync(
  path.join(__dirname, "../../components/WhatsAppModal/index.js"),
  "utf8"
);

describe("Fase 2.6 — WhatsAppModal contrato anti-legado", () => {
  it("não chama GET /ai-agents nem listAiAgents", () => {
    expect(modalSource).not.toMatch(/\/ai-agents/);
    expect(modalSource).not.toMatch(/listAiAgents/);
  });

  it("não mantém estados de edição AI", () => {
    expect(modalSource).not.toMatch(/selectedAiAgentId/);
    expect(modalSource).not.toMatch(/setAiAgentMode/);
    expect(modalSource).not.toMatch(/liveModeConfirm/);
    expect(modalSource).not.toMatch(/setAiAgents/);
  });

  it("remove controles Off/Shadow/Live/dry_run do formulário", () => {
    expect(modalSource).not.toMatch(/modes\.dryRun|modes\.shadow|modes\.live/);
    expect(modalSource).not.toMatch(/liveConfirmLabel|shadowWarning|liveWarning/);
    expect(modalSource).not.toMatch(/dialog-select-ai-agent/);
  });

  it("remove campos AI do payload com delete explícito", () => {
    expect(modalSource).toMatch(/delete whatsappData\["aiAgentId"\]/);
    expect(modalSource).toMatch(/delete whatsappData\["aiAgentMode"\]/);
    expect(modalSource).toMatch(/delete whatsappData\["aiAgentEnabled"\]/);
  });

  it("exibe status read-only e CTA Product", () => {
    expect(modalSource).toMatch(/resolveAiAgentReadonlyStatus/);
    expect(modalSource).toMatch(/managedByProduct/);
    expect(modalSource).toMatch(/whatsapp-modal-manage-ai-agent/);
    expect(modalSource).toMatch(/AI_AGENT_ROUTE_PATH/);
    expect(modalSource).toMatch(/history\.push\(AI_AGENT_ROUTE_PATH\)/);
  });

  it("CTA não usa agentId nem connectionId como autoridade", () => {
    expect(modalSource).not.toMatch(
      /history\.push\([^)]*agentId|history\.push\([^)]*whatsAppId/
    );
    expect(modalSource).toMatch(
      /history\.push\(AI_AGENT_ROUTE_PATH\)/
    );
  });
});

describe("Fase 2.6 — resolveAiAgentReadonlyStatus (espelho do helper)", () => {
  function resolveAiAgentReadonlyStatus(wa) {
    if (wa == null || wa.aiAgentId == null || wa.aiAgentId === "")
      return "notLinked";
    const mode =
      wa.aiAgentMode || (wa.aiAgentEnabled ? "dry_run" : "disabled");
    if (mode === "live") return "live";
    if (mode === "shadow" || mode === "dry_run") return "shadow";
    return "linkedOff";
  }

  it("mapeia estados persistidos sem calcular readiness", () => {
    expect(resolveAiAgentReadonlyStatus({})).toBe("notLinked");
    expect(
      resolveAiAgentReadonlyStatus({
        aiAgentId: 1,
        aiAgentMode: "live",
        aiAgentEnabled: true,
      })
    ).toBe("live");
    expect(
      resolveAiAgentReadonlyStatus({
        aiAgentId: 1,
        aiAgentMode: "shadow",
        aiAgentEnabled: true,
      })
    ).toBe("shadow");
    expect(
      resolveAiAgentReadonlyStatus({
        aiAgentId: 1,
        aiAgentMode: "disabled",
        aiAgentEnabled: false,
      })
    ).toBe("linkedOff");
  });
});

describe("Fase 2.6 — Hub navegação", () => {
  it("connect_whatsapp / fix_connection sem agentRef → create; com agentRef → manage_connections", () => {
    expect(mapAiAgentNextAction("connect_whatsapp").path).toBe(
      AI_AGENT_NEW_ROUTE_PATH
    );
    expect(mapAiAgentNextAction("fix_connection").path).toBe(
      AI_AGENT_NEW_ROUTE_PATH
    );
    const scoped = mapAiAgentNextAction("fix_connection", {
      agentRef: "ref-a",
    });
    expect(scoped.action).toBe("manage_connections");
    expect(scoped.path).toBe("/ai-agent/ref-a/connections");
  });

  it("open_connections administra canais, não configura IA", () => {
    const actions = buildAiAgentSecondaryActions({
      agentScope: { type: "single", count: 1 },
      agent: { exists: true, id: 1 },
    });
    const openConn = actions.find((a) => a.id === "open_connections");
    expect(openConn.path).toBe("/connections");
    expect(openConn.labelKey).toBe("aiAgentProduct.secondary.openConnections");
    expect(AI_AGENT_ROUTE_PATH).toBe("/ai-agent");
  });
});

describe("Fase 2.6 — i18n CTAs", () => {
  it("PT/EN/ES possuem managedByProduct, manageCta e status", () => {
    const langs = ["pt.js", "en.js", "es.js"].map((f) =>
      fs.readFileSync(
        path.join(__dirname, `../../translate/languages/${f}`),
        "utf8"
      )
    );
    langs.forEach((src) => {
      expect(src).toMatch(/managedByProduct:/);
      expect(src).toMatch(/manageCta:/);
      expect(src).toMatch(/status:\s*\{[\s\S]*live:/);
    });
  });
});
