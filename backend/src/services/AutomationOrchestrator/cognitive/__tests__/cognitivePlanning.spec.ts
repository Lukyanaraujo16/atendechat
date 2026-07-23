/**
 * AI Agent V2.0 — Cognitive Planning Engine tests
 */
import { GOAL_TYPES } from "../../../../config/automationCognitivePlanningConstants";
import { detectIntent } from "../IntentDetection";
import { analyzeGoal } from "../GoalAnalyzer";
import { planFromGoal } from "../CognitivePlanner";
import {
  buildDependencyGraph,
  getReadySteps
} from "../DependencyResolver";
import { validateStep, validatePlanSteps } from "../ValidationEngine";
import {
  suggestRecovery,
  buildRecoveryForValidations
} from "../RecoveryEngine";
import { replayCognitivePlan } from "../PlanReplay";
import {
  __resetCognitivePlanningMetricsForTests,
  getCognitivePlanningMetrics
} from "../CognitivePlanningMetrics";
import {
  __resetCognitivePlanningStoreForTests,
  GetCognitivePlanningDashboardService,
  AnalyzeGoalService,
  GeneratePlanService,
  InspectDependenciesService,
  SimulateRecoveryService,
  ReplayPlanService
} from "../CognitivePlanningAdminServices";

describe("Cognitive Planning V2.0", () => {
  beforeEach(() => {
    __resetCognitivePlanningMetricsForTests();
    __resetCognitivePlanningStoreForTests();
  });

  it("Goal types iniciais estão definidos", () => {
    expect(GOAL_TYPES).toEqual(
      expect.arrayContaining([
        "ANSWER_QUESTION",
        "SEARCH_INFORMATION",
        "UPDATE_CONTACT",
        "TRANSFER_TICKET",
        "SEND_MESSAGE",
        "EXECUTE_AUTOMATION",
        "SCHEDULE_EVENT",
        "MULTI_STEP_TASK",
        "CUSTOM"
      ])
    );
  });

  it("Goal Analyzer transforma NL em Goal", () => {
    const goal = analyzeGoal({
      text: "Quero transferir para um atendente humano",
      companyId: 1
    });
    expect(goal.type).toBe("TRANSFER_TICKET");
    expect(goal.id).toMatch(/^goal_/);
    expect(goal.requiresConfirmation).toBe(true);
    expect(goal.constraints).toContain("no_tool_execution_in_planner");
    expect(goal.metadata.executesTools).toBe(false);
  });

  it("Intent Detection cobre busca e pergunta", () => {
    expect(detectIntent("qual o status do pedido 12345?").goalType).toBe(
      "SEARCH_INFORMATION"
    );
    expect(detectIntent("como funciona o produto?").goalType).toBe(
      "ANSWER_QUESTION"
    );
  });

  it("Cognitive Planner gera ExecutionPlan sem executar tools", () => {
    const goal = analyzeGoal({
      text: "buscar informações do protocolo ABC99",
      companyId: 2
    });
    const plan = planFromGoal(goal);
    expect(plan.goalId).toBe(goal.id);
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.status).toBe("ready");
    expect(plan.metadata?.executesTools).toBe(false);
    expect(plan.metadata?.knowsProviders).toBe(false);
    expect(plan.metadata?.knowsToolRuntime).toBe(false);
    expect(plan.postConditions).toContain("tools_not_invoked_by_planner");
  });

  it("Dependency Resolver ordena e agrupa paralelismo futuro", () => {
    const goal = analyzeGoal({
      text: "preciso buscar o pedido e depois me diga o status e também atualize",
      companyId: 3
    });
    const plan = planFromGoal(goal);
    const graph = buildDependencyGraph(plan.steps);
    expect(graph.order.length).toBe(plan.steps.length);
    expect(graph.cycles.length).toBe(0);
    expect(graph.parallelGroups.length).toBeGreaterThanOrEqual(1);
    const ready = getReadySteps(plan.steps, new Set());
    expect(ready.length).toBeGreaterThanOrEqual(1);
  });

  it("Validation Engine retorna VALID/FAILED/PARTIAL/SKIPPED", () => {
    const goal = analyzeGoal({ text: "agendar reunião amanhã", companyId: 4 });
    const plan = planFromGoal(goal);
    const step = plan.steps[0];
    expect(validateStep({ step, simulatedOutcome: { success: true } }).result).toBe(
      "VALID"
    );
    expect(
      validateStep({ step, simulatedOutcome: { success: false } }).result
    ).toBe("FAILED");
    expect(
      validateStep({ step, simulatedOutcome: { partial: true } }).result
    ).toBe("PARTIAL");
    expect(
      validateStep({ step, simulatedOutcome: { skipped: true } }).result
    ).toBe("SKIPPED");
  });

  it("Recovery Engine só sugere (autoExecute=false)", () => {
    const goal = analyzeGoal({
      text: "atualizar meu email x@y.com",
      companyId: 5
    });
    const plan = planFromGoal(goal);
    const step = plan.steps.find(s => s.requiresConfirmation) || plan.steps[1];
    const validation = validateStep({
      step,
      simulatedOutcome: { partial: true, note: "awaiting_confirmation" }
    });
    const recovery = suggestRecovery({ plan, step, validation });
    expect(recovery.autoExecute).toBe(false);
    expect(recovery.action).toBe("ASK_CONFIRMATION");
    const many = buildRecoveryForValidations({
      plan,
      validations: validatePlanSteps(plan.steps, {
        [step.id]: { success: false, note: "boom" }
      })
    });
    expect(many.length).toBeGreaterThanOrEqual(1);
    expect(many.every(r => r.autoExecute === false)).toBe(true);
  });

  it("Plan Replay cobre Goal→Plan→Deps→Validation→Recovery", () => {
    const replay = replayCognitivePlan({
      companyId: 6,
      text: "transferir para atendente",
      simulatedOutcomes: {
        s2: { partial: true, note: "awaiting_confirmation" }
      }
    });
    expect(replay.goal.type).toBe("TRANSFER_TICKET");
    expect(replay.plan.steps.length).toBeGreaterThan(0);
    expect(replay.dependencyOrder.length).toBe(replay.plan.steps.length);
    expect(replay.validations.length).toBe(replay.plan.steps.length);
    expect(replay.recoveries.length).toBeGreaterThanOrEqual(1);
  });

  it("Métricas registram plansGenerated e médias", async () => {
    await GeneratePlanService({
      companyId: 7,
      text: "como faço para cancelar?"
    });
    await GeneratePlanService({
      companyId: 7,
      text: "agendar consulta"
    });
    const m = getCognitivePlanningMetrics(7);
    expect(m.plansGenerated).toBe(2);
    expect(m.averageSteps).toBeGreaterThan(0);
    expect(m.averageComplexity).toBeGreaterThan(0);
  });

  it("Dashboard e Tester services funcionam", async () => {
    await AnalyzeGoalService({
      companyId: 8,
      text: "envie uma mensagem para o cliente"
    });
    await ReplayPlanService({
      companyId: 8,
      text: "buscar status do pedido 999"
    });
    await SimulateRecoveryService({ companyId: 8 });
    const deps = await InspectDependenciesService({
      companyId: 8,
      text: "quero falar com humano"
    });
    expect(deps.parallelGroups.length).toBeGreaterThanOrEqual(1);
    const dash = await GetCognitivePlanningDashboardService({ companyId: 8 });
    expect(dash.guarantees.plannerExecutesTools).toBe(false);
    expect(dash.guarantees.livePipelineUnchanged).toBe(true);
    expect(dash.recentGoals.length).toBeGreaterThan(0);
    expect(dash.recentPlans.length).toBeGreaterThan(0);
  });
});
