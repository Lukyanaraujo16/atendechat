import {
  observeAgentOsStep,
  resetAgentOsEvents,
  resetTimelines,
  resetObservabilityMetrics,
  resetAgentOsAlerts,
  resetObservabilityConfig,
  createTraceContext,
  rebuildExecutionFromPersistence,
  exportObservability,
  buildAgentOsHealth,
  raiseAgentOsAlert,
  listAgentOsAlerts,
  getObservabilityMetrics,
  getTimeline,
  listAgentOsEvents,
  finishTimeline,
  startTimeline,
  recordObservedStep,
  emitAgentOsEvent,
  runObservabilityOps,
  percentile
} from "../index";
import { GetObservabilityDashboardService } from "../ObservabilityAdminServices";

jest.mock("../../security/AgentOsPlanGate", () => ({
  assertAgentOsPlanFeature: jest.fn(async () => undefined)
}));

describe("AgentOS Observability Wave 3", () => {
  beforeEach(() => {
    resetObservabilityConfig();
    resetObservabilityMetrics();
    resetAgentOsEvents();
    resetTimelines();
    resetAgentOsAlerts();
  });

  it("creates correlated trace ids", () => {
    const ctx = createTraceContext({ companyId: 7, agentId: "a1" });
    expect(ctx.traceId).toMatch(/^trace_/);
    expect(ctx.correlationId).toMatch(/^corr_/);
    expect(ctx.executionId).toMatch(/^exec_/);
    expect(ctx.sessionId).toBe(ctx.rootSessionId);
    expect(ctx.companyId).toBe(7);
    expect(ctx.agentId).toBe("a1");
  });

  it("builds timeline + events + metrics for a step", () => {
    const ctx = observeAgentOsStep({
      companyId: 1,
      origin: "planner",
      type: "planner.plan_generated",
      latencyMs: 120,
      success: true,
      finish: true
    });
    const tl = getTimeline(ctx.traceId);
    expect(tl?.steps.length).toBe(1);
    expect(tl?.steps[0].latencyMs).toBe(120);
    const events = listAgentOsEvents(1, { traceId: ctx.traceId });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].traceId).toBe(ctx.traceId);
    const metrics = getObservabilityMetrics(1);
    expect(metrics.throughput).toBe(1);
    expect(metrics.averageLatency).toBe(120);
  });

  it("computes percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBeGreaterThan(0);
  });

  it("raises and lists alerts", () => {
    raiseAgentOsAlert({
      companyId: 2,
      type: "high_latency",
      severity: "critical",
      message: "latencia"
    });
    const alerts = listAgentOsAlerts(2);
    expect(alerts[0].type).toBe("high_latency");
  });

  it("builds health report", () => {
    observeAgentOsStep({
      companyId: 3,
      origin: "runtime",
      type: "runtime.execution",
      latencyMs: 50,
      success: true,
      finish: true
    });
    const health = buildAgentOsHealth(3);
    expect(["Healthy", "Degraded", "Critical", "Unknown"]).toContain(health.status);
    expect(health.components.length).toBeGreaterThan(3);
  });

  it("reconstructs execution from timeline persistence path", async () => {
    const ctx = observeAgentOsStep({
      companyId: 4,
      origin: "evaluation",
      type: "evaluation.scored",
      latencyMs: 33,
      success: true,
      finish: true
    });
    const rebuilt = await rebuildExecutionFromPersistence({
      companyId: 4,
      traceId: ctx.traceId
    });
    expect(rebuilt.traceId).toBe(ctx.traceId);
    expect(rebuilt.complete).toBe(true);
    expect(rebuilt.timeline?.steps.length).toBe(1);
  });

  it("exports metrics as json and csv", async () => {
    observeAgentOsStep({
      companyId: 5,
      origin: "api",
      type: "api.call",
      latencyMs: 10,
      success: true,
      finish: true
    });
    const json = await exportObservability({
      companyId: 5,
      kind: "metrics",
      format: "json"
    });
    expect(json.format).toBe("json");
    const csv = await exportObservability({
      companyId: 5,
      kind: "events",
      format: "csv"
    });
    expect(csv.format).toBe("csv");
    expect((csv as any).csv).toContain("eventId");
  });

  it("runs health_check ops", async () => {
    const out = await runObservabilityOps({
      companyId: 6,
      operation: "health_check"
    });
    expect(out.operation).toBe("health_check");
    expect((out.result as any).status).toBeTruthy();
  });

  it("dashboard aggregates operational panels", async () => {
    observeAgentOsStep({
      companyId: 8,
      origin: "tool",
      type: "tool.exec",
      latencyMs: 40,
      success: false,
      errorCode: "ERR_TOOL",
      toolId: "search",
      finish: true
    });
    const dash = await GetObservabilityDashboardService({ companyId: 8 });
    expect(dash.health).toBeTruthy();
    expect(dash.metrics.topErrors[0]?.code).toBe("ERR_TOOL");
    expect(dash.topTools[0]?.id).toBe("search");
  });

  it("keeps live disabled in observability config", () => {
    const { getObservabilityConfig } = require("../ObservabilityConfig");
    expect(getObservabilityConfig().liveIntegrationAllowed).toBe(false);
  });

  it("manual timeline correlation chain", () => {
    const ctx = createTraceContext({ companyId: 9 });
    startTimeline(ctx);
    recordObservedStep({
      ctx,
      origin: "planner",
      latencyMs: 10,
      status: "ok",
      inputPayload: { goal: "x" },
      outputPayload: { steps: 2 }
    });
    recordObservedStep({
      ctx,
      origin: "runtime",
      latencyMs: 20,
      status: "ok"
    });
    emitAgentOsEvent({
      ctx,
      type: "chain.link",
      origin: "system",
      payload: { n: 1 }
    });
    finishTimeline(ctx.traceId);
    const tl = getTimeline(ctx.traceId);
    expect(tl?.steps.map(s => s.origin)).toEqual(["planner", "runtime"]);
  });
});
