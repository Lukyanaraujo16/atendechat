/**
 * Fase 2.1E — Shadow Function Calling
 */
import { buildObjectiveComparison, estimateCostUsd } from "../shadowFc/shadowFcComparison";
import {
  __resetShadowFcMetricsForTests,
  getShadowFcMetricsSnapshot,
  recordShadowFcExecution
} from "../shadowFc/ShadowFcMetrics";
import { selectToolsForFunctionCalling } from "../../AutomationOrchestrator/tools/functionCalling/AutomationToolSelectionEngine";
import { buildFunctionCallingToolContext } from "../../AutomationOrchestrator/tools/functionCalling/AutomationFunctionCallResolver";
import {
  registerBuiltinTools,
  resetBuiltinToolsRegistration
} from "../../AutomationOrchestrator/tools/registerBuiltinTools";
import {
  clearToolRegistry,
  listTools
} from "../../AutomationOrchestrator/tools/ToolRegistry";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../../../config/automationOrchestratorConstants";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../../../config/automationToolConstants";
import { __resetToolCircuitBreakerForTests } from "../../AutomationOrchestrator/tools/ToolCircuitBreaker";
import { __resetToolRateLimitForTests } from "../../AutomationOrchestrator/tools/ToolRateLimit";
import { __resetToolMetricsForTests } from "../../AutomationOrchestrator/tools/ToolMetrics";
import { __resetToolEventsForTests } from "../../AutomationOrchestrator/tools/ToolEventBus";

describe("Shadow Function Calling 2.1E", () => {
  beforeEach(() => {
    resetBuiltinToolsRegistration();
    clearToolRegistry();
    __resetToolCircuitBreakerForTests();
    __resetToolRateLimitForTests();
    __resetToolMetricsForTests();
    __resetToolEventsForTests();
    __resetShadowFcMetricsForTests();
    registerBuiltinTools();
  });

  it("comparação objetiva sem IA", () => {
    const cmp = buildObjectiveComparison({
      officialReply: "Olá, como posso ajudar?",
      shadowReply: "Olá! Posso ajudar com seu ticket.",
      officialLatencyMs: 100,
      shadowLatencyMs: 250,
      officialTokens: 40,
      shadowTokens: 80,
      usedTools: true,
      usedKnowledgeOfficial: false,
      usedKnowledgeShadow: true,
      toolCallCount: 2
    });
    expect(cmp.textual).toBeTruthy();
    expect((cmp.textual as any).exactMatch).toBe(false);
    expect((cmp.tools as any).toolCallCount).toBe(2);
    expect((cmp.knowledge as any).shadow).toBe(true);
    expect(estimateCostUsd(1000)).toBeGreaterThan(0);
  });

  it("Selection origin shadow só read/expose", () => {
    const ctx = buildFunctionCallingToolContext({
      companyId: 1,
      allowedToolKeys: [],
      source: "shadow",
      channel: "shadow",
      featureFlags: {
        [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
        [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true,
        "automation.knowledge_base": true
      }
    });
    const selection = selectToolsForFunctionCalling({
      ctx,
      origin: "shadow",
      provider: "openai",
      companyPolicy: {
        enabled: true,
        maxRiskLevel: "read_only",
        allowWrite: false
      }
    });
    expect(selection.tools.length).toBeGreaterThan(0);
    expect(selection.tools.every(t => t.exposeToModel)).toBe(true);
    expect(
      selection.tools.every(t => t.sideEffectType !== "database_write")
    ).toBe(true);
    expect(selection.tools.some(t => t.id === "ticket.transfer")).toBe(false);
  });

  it("Write Tools permanecem invisíveis no registry expose", () => {
    const writes = listTools({ includeExperimental: true }).filter(
      t => t.sideEffectType === "database_write"
    );
    expect(writes.every(t => t.exposeToModel === false)).toBe(true);
  });

  it("métricas shadow FC", () => {
    recordShadowFcExecution({
      companyId: 1,
      provider: "openai",
      usedTools: true,
      usedKnowledge: true,
      toolCallCount: 2,
      toolLatencyMs: 30,
      providerLatencyMs: 100,
      tokens: 50,
      costUsd: 0.0001,
      selectedToolIds: ["queue.list", "contact.search"],
      resolutions: [
        { toolId: "queue.list", status: "success" },
        { toolId: "contact.search", status: "denied" }
      ]
    });
    const snap = getShadowFcMetricsSnapshot(1);
    expect(snap.shadowExecutions).toBe(1);
    expect(snap.shadowWithTools).toBe(1);
    expect(snap.toolDeniedRate).toBeGreaterThan(0);
    expect(snap.topDenials.length).toBeGreaterThanOrEqual(1);
    expect(snap.byProvider.openai).toBe(1);
  });

  it("contexto shadow é observacional", () => {
    const ctx = buildFunctionCallingToolContext({
      companyId: 1,
      ticketId: 9,
      contactId: 3,
      allowedToolKeys: ["queue.list@1.0.0"],
      source: "shadow"
    });
    expect(ctx.source).toBe("shadow");
    expect(ctx.controlMode).toBe("shadow_execute");
    expect(ctx.metadata?.observational).toBe(true);
  });
});
