/**
 * AI Agent V2.3 — Action Execution Engine tests
 */
import {
  ACTION_TYPES,
  ACTION_EXECUTION_STATUSES,
  ACTION_VALIDATION_RESULTS,
  ACTION_ENGINE_EVENTS
} from "../../../../../config/automationActionExecutionConstants";
import { ExecutionStrategyRegistry } from "../ExecutionStrategyRegistry";
import {
  ActionExecutionEngine,
  mapStepToExecutionAction
} from "../ActionExecutionEngine";
import {
  __resetActionExecutionConfigForTests,
  getActionExecutionConfig,
  setActionExecutionConfig
} from "../ActionExecutionConfig";
import {
  __resetActionExecutionMetricsForTests,
  getActionExecutionMetrics,
  recordActionExecutionResult
} from "../ActionExecutionMetrics";
import {
  __resetActionExecutionAdminForTests,
  ExecuteActionService,
  GetActionExecutionDashboardService,
  InspectStrategyService,
  ListStrategiesService,
  ReplayActionExecutionService
} from "../ActionExecutionAdminServices";
import { __resetExecutionSessionsForTests } from "../../execution/ExecutionOrchestratorAdminServices";
import searchStrategy from "../strategies/SearchStrategy";

describe("Action Execution Engine V2.3", () => {
  beforeEach(() => {
    __resetActionExecutionConfigForTests();
    __resetActionExecutionMetricsForTests();
    __resetActionExecutionAdminForTests();
    __resetExecutionSessionsForTests();
  });

  it("action types, statuses, validation e eventos definidos", () => {
    expect(ACTION_TYPES).toContain("SEARCH");
    expect(ACTION_TYPES).toContain("WAIT_INPUT");
    expect(ACTION_EXECUTION_STATUSES).toContain("WAITING");
    expect(ACTION_VALIDATION_RESULTS).toContain("PARTIAL");
    expect(ACTION_ENGINE_EVENTS).toContain("ACTION_COMPLETED");
  });

  it("Strategy Registry resolve por ActionType sem switch gigante", () => {
    const registry = new ExecutionStrategyRegistry();
    const action = mapStepToExecutionAction({
      stepId: "s1",
      stepType: "search",
      objective: "buscar pedido"
    });
    const strategy = registry.resolve(action);
    expect(strategy?.name).toBe("SearchStrategy");
    expect(registry.list().length).toBeGreaterThanOrEqual(8);
  });

  it("SearchStrategy retorna resultado simulado sem Tool Runtime", async () => {
    const action = mapStepToExecutionAction({
      stepId: "s1",
      stepType: "search",
      objective: "buscar"
    });
    const engine = new ActionExecutionEngine();
    const { result, events } = await engine.execute(action);
    expect(result.status).toBe("SUCCESS");
    expect(result.strategy).toBe("SearchStrategy");
    expect(result.output.usesToolRuntime).toBe(false);
    expect(result.metadata.executesTools).toBe(false);
    expect(events.some(e => e.name === "ACTION_STARTED")).toBe(true);
    expect(events.some(e => e.name === "ACTION_COMPLETED")).toBe(true);
  });

  it("ConfirmationStrategy retorna WAITING", async () => {
    const action = mapStepToExecutionAction({
      stepId: "c1",
      stepType: "confirm",
      objective: "confirmar transferência",
      requiresConfirmation: true
    });
    const engine = new ActionExecutionEngine();
    const { result } = await engine.execute(action);
    expect(result.validation).toBe("WAITING");
    expect(result.status).toBe("WAITING");
    expect(result.strategy).toBe("ConfirmationStrategy");
  });

  it("config administrativa por strategy (timeout/retry/validation)", () => {
    setActionExecutionConfig(1, {
      strategies: {
        SEARCH: { timeoutMs: 999, maxRetries: 2, validationEnabled: false }
      }
    });
    const cfg = getActionExecutionConfig(1);
    expect(cfg.strategies.SEARCH.timeoutMs).toBe(999);
    expect(cfg.usesToolRuntime).toBe(false);
  });

  it("métricas registram success/failure/waiting e strategy usage", async () => {
    const engine = new ActionExecutionEngine();
    const a1 = await engine.execute(
      mapStepToExecutionAction({
        stepId: "m1",
        stepType: "search",
        objective: "a"
      })
    );
    recordActionExecutionResult(a1.result);
    const metrics = getActionExecutionMetrics();
    expect(metrics.actionsExecuted).toBeGreaterThanOrEqual(1);
    expect(metrics.strategyUsage.SearchStrategy).toBeGreaterThanOrEqual(1);
  });

  it("ExecuteActionService via admin layer", async () => {
    const { result } = await ExecuteActionService({
      companyId: 5,
      stepId: "x",
      stepType: "transfer",
      objective: "transferir"
    });
    expect(result.actionType).toBe("TRANSFER");
    expect(result.metadata.usesToolRuntime).toBe(false);
  });

  it("ListStrategiesService e InspectStrategyService", async () => {
    const list = await ListStrategiesService();
    expect(list.usesToolRuntime).toBe(false);
    expect(list.strategies.length).toBeGreaterThanOrEqual(8);
    const inspect = await InspectStrategyService({ actionType: "SEARCH" });
    expect(inspect.strategy).toBe("SearchStrategy");
  });

  it("dashboard retorna cards agregados", async () => {
    await ExecuteActionService({
      companyId: 6,
      stepId: "d1",
      stepType: "analyze",
      objective: "validar"
    });
    const dash = await GetActionExecutionDashboardService({ companyId: 6 });
    expect(dash.strategies).toBeGreaterThanOrEqual(8);
    expect(dash.usesToolRuntime).toBe(false);
    expect(typeof dash.successRate).toBe("number");
  });

  it("replay expande Goal→Plan→Evaluation→Session→Action→Result", async () => {
    const { replay } = await ReplayActionExecutionService({
      companyId: 7,
      text: "como funciona o produto?"
    });
    expect(replay.goal).toBeTruthy();
    expect(replay.plan).toBeTruthy();
    expect(replay.session).toBeTruthy();
    expect(replay.actionExecutions?.length).toBeGreaterThan(0);
    expect(replay.actionExecutions?.[0]?.result.metadata.usesToolRuntime).toBe(
      false
    );
  });

  it("registry plugável aceita strategy customizada", () => {
    const registry = new ExecutionStrategyRegistry([searchStrategy]);
    const action = mapStepToExecutionAction({
      stepId: "p1",
      stepType: "search",
      objective: "plug"
    });
    expect(registry.resolve(action)?.name).toBe("SearchStrategy");
  });
});
