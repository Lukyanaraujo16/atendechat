/**
 * AI Agent V2.2 — Execution Orchestrator tests
 */
import { analyzeGoal } from "../../GoalAnalyzer";
import { planFromGoal } from "../../CognitivePlanner";
import { evaluatePlan } from "../../evaluation/PlanEvaluationEngine";
import { buildExecutionGraph } from "../ExecutionGraphBuilder";
import {
  validateTransition,
  listAllowedTransitions
} from "../StateValidator";
import { resolveNextSteps } from "../NextStepResolver";
import { decideRecoveryAction } from "../RecoveryOrchestration";
import {
  openExecutionSession,
  startExecutionSession,
  pauseExecutionSession,
  resumeExecutionSession,
  abortExecutionSession,
  advanceExecutionStep
} from "../ExecutionOrchestrator";
import {
  __resetExecutionOrchestratorConfigForTests,
  setExecutionOrchestratorConfig
} from "../ExecutionOrchestratorConfig";
import { __resetExecutionOrchestratorMetricsForTests } from "../ExecutionOrchestratorMetrics";
import {
  __resetExecutionSessionsForTests,
  CreateExecutionSessionService,
  GetExecutionSessionsDashboardService,
  ReplayExecutionSessionService,
  SimulateTransitionService
} from "../ExecutionOrchestratorAdminServices";
import {
  EXECUTION_SESSION_STATUSES,
  VALID_SESSION_TRANSITIONS
} from "../../../../../config/automationExecutionOrchestratorConstants";

describe("Execution Orchestrator V2.2", () => {
  beforeEach(() => {
    __resetExecutionOrchestratorConfigForTests();
    __resetExecutionOrchestratorMetricsForTests();
    __resetExecutionSessionsForTests();
  });

  it("statuses e transições estão definidos", () => {
    expect(EXECUTION_SESSION_STATUSES).toContain("RUNNING");
    expect(VALID_SESSION_TRANSITIONS.CREATED).toContain("READY");
    expect(VALID_SESSION_TRANSITIONS.RUNNING).toContain("COMPLETED");
  });

  it("Graph Builder gera ExecutionGraph sem executar", () => {
    const goal = analyzeGoal({ text: "como funciona?", companyId: 1 });
    const plan = planFromGoal(goal);
    const graph = buildExecutionGraph(plan);
    expect(graph.planId).toBe(plan.id);
    expect(graph.nodes.length).toBe(plan.steps.length);
    expect(graph.order.length).toBe(plan.steps.length);
    expect(graph.entryNodeIds.length).toBeGreaterThan(0);
  });

  it("State Validator bloqueia transição inválida", () => {
    expect(validateTransition("CREATED", "COMPLETED").allowed).toBe(false);
    expect(validateTransition("READY", "RUNNING").allowed).toBe(true);
    expect(listAllowedTransitions("PAUSED")).toContain("RUNNING");
  });

  it("abre sessão CREATED→READY e inicia RUNNING", () => {
    const goal = analyzeGoal({ text: "buscar pedido 1", companyId: 2 });
    const plan = planFromGoal(goal);
    const evaluation = evaluatePlan({ plan, goal, companyId: 2 });
    const session = openExecutionSession({
      companyId: 2,
      goal,
      plan,
      evaluation
    });
    expect(session.status).toBe("READY");
    expect(session.metadata.executesTools).toBe(false);
    expect(session.executionContext.executesTools).toBe(false);
    const started = startExecutionSession(session);
    expect(["RUNNING", "WAITING_CONFIRMATION", "COMPLETED"]).toContain(
      started.session.status
    );
    expect(started.session.events.some(e => e.name === "SESSION_STARTED")).toBe(
      true
    );
  });

  it("Next Step Resolver libera etapas por dependência", () => {
    const goal = analyzeGoal({ text: "como funciona o produto?", companyId: 3 });
    const plan = planFromGoal(goal);
    const session = openExecutionSession({
      companyId: 3,
      goal,
      plan,
      evaluation: evaluatePlan({ plan, goal, companyId: 3 })
    });
    startExecutionSession(session);
    const next = resolveNextSteps(session);
    expect(next.ready.length + (next.nextStepId ? 1 : 0)).toBeGreaterThan(0);
    expect(next.blocked.every(b => b.reason)).toBe(true);
  });

  it("pause / resume / abort", () => {
    const goal = analyzeGoal({ text: "agendar consulta", companyId: 4 });
    const plan = planFromGoal(goal);
    const session = openExecutionSession({
      companyId: 4,
      goal,
      plan,
      evaluation: null
    });
    startExecutionSession(session);
    pauseExecutionSession(session);
    expect(session.status).toBe("PAUSED");
    resumeExecutionSession(session);
    expect(session.status).toBe("RUNNING");
    abortExecutionSession(session);
    expect(session.status).toBe("ABORTED");
  });

  it("avança steps até COMPLETED sem tools", () => {
    const goal = analyzeGoal({ text: "como funciona?", companyId: 5 });
    const plan = planFromGoal(goal);
    const session = openExecutionSession({
      companyId: 5,
      goal,
      plan,
      evaluation: evaluatePlan({ plan, goal, companyId: 5 })
    });
    startExecutionSession(session);
    let guard = 0;
    while (session.status === "RUNNING" || session.status === "WAITING_CONFIRMATION") {
      if (guard++ > 30) break;
      const next = resolveNextSteps(session);
      if (next.waitingConfirmation.length) {
        advanceExecutionStep({
          session,
          action: "confirm",
          stepId: next.waitingConfirmation[0]
        });
        advanceExecutionStep({
          session,
          action: "complete",
          stepId: next.waitingConfirmation[0]
        });
      } else if (next.nextStepId) {
        advanceExecutionStep({
          session,
          action: "complete",
          stepId: next.nextStepId
        });
      } else break;
    }
    expect(session.status).toBe("COMPLETED");
    expect(session.completedSteps.length).toBe(plan.steps.length);
  });

  it("Recovery orchestration decide sem executar", () => {
    const goal = analyzeGoal({ text: "enviar mensagem", companyId: 6 });
    const plan = planFromGoal(goal);
    const session = openExecutionSession({
      companyId: 6,
      goal,
      plan,
      evaluation: null
    });
    startExecutionSession(session);
    const stepId = session.graph.order[0];
    const decision = decideRecoveryAction({ session, stepId });
    expect(decision.autoExecute).toBe(false);
    expect(["RETRY", "SKIP", "ABORT", "ASK_CONFIRMATION", "REPLAN"]).toContain(
      decision.action
    );

    advanceExecutionStep({ session, action: "fail", stepId });
    expect(["RECOVERING", "FAILED", "WAITING_CONFIRMATION", "RUNNING"]).toContain(
      session.status
    );
  });

  it("config administrativa sem hardcode no limite", () => {
    setExecutionOrchestratorConfig(7, { maxStepsPerSession: 1 });
    const goal = analyzeGoal({ text: "multi step e depois outra coisa", companyId: 7 });
    const plan = planFromGoal(goal);
    expect(() =>
      openExecutionSession({ companyId: 7, goal, plan, evaluation: null })
    ).toThrow(/max_steps_exceeded/);
  });

  it("Dashboard / Replay / Transition API services", async () => {
    await CreateExecutionSessionService({
      companyId: 8,
      text: "consultar status do pedido"
    });
    const dash = await GetExecutionSessionsDashboardService({ companyId: 8 });
    expect(dash.guarantees.executesTools).toBe(false);
    expect(dash.guarantees.liveUnchanged).toBe(true);
    expect(dash.metrics.sessionsCreated).toBeGreaterThan(0);

    const replay = await ReplayExecutionSessionService({
      companyId: 8,
      text: "como funciona?"
    });
    expect(replay.replay.finalState).toBeTruthy();
    expect(replay.replay.stepTimeline).toBeDefined();

    const t = await SimulateTransitionService({
      from: "RUNNING",
      to: "COMPLETED"
    });
    expect(t.allowed).toBe(true);
  });

  it("checkpoints são criados quando configurado", () => {
    const goal = analyzeGoal({ text: "como funciona?", companyId: 9 });
    const plan = planFromGoal(goal);
    const session = openExecutionSession({
      companyId: 9,
      goal,
      plan,
      evaluation: null
    });
    expect(session.checkpoints.length).toBeGreaterThanOrEqual(1);
    startExecutionSession(session);
    const next = resolveNextSteps(session);
    if (next.nextStepId) {
      advanceExecutionStep({
        session,
        action: "complete",
        stepId: next.nextStepId
      });
    }
    expect(session.events.some(e => e.name === "STEP_COMPLETED")).toBe(true);
  });
});
