/**
 * AI Agent V2.1 — Plan Evaluation Engine tests
 */
import { analyzeGoal } from "../../GoalAnalyzer";
import { planFromGoal } from "../../CognitivePlanner";
import { evaluatePlan } from "../PlanEvaluationEngine";
import { runAllValidators } from "../validators";
import {
  computePlanScore,
  decideApproval,
  buildRecommendations
} from "../QualityScore";
import {
  getPlanEvaluationConfig,
  setPlanEvaluationConfig,
  __resetPlanEvaluationConfigForTests
} from "../PlanEvaluationConfig";
import {
  __resetPlanEvaluationMetricsForTests,
  getPlanEvaluationMetrics
} from "../PlanEvaluationMetrics";
import {
  __resetPlanEvaluationStoreForTests,
  EvaluatePlanService,
  GetPlanEvaluationDashboardService,
  ListPlanEvaluationsService,
  DiffPlansService
} from "../PlanEvaluationAdminServices";
import { replayCognitivePlan } from "../../PlanReplay";
import { PLAN_EVALUATION_VALIDATORS } from "../../../../../config/automationPlanEvaluationConstants";
import { ExecutionPlan, ExecutionStep } from "../../types";

function brokenPlan(goalId: string): ExecutionPlan {
  const base = planFromGoal(
    analyzeGoal({ text: "transferir para atendente", companyId: 1 })
  );
  const badStep: ExecutionStep = {
    ...base.steps[0],
    id: "bad",
    dependsOn: ["missing_dep"],
    requiresConfirmation: false,
    type: "transfer"
  };
  return {
    ...base,
    goalId,
    steps: [...base.steps, badStep],
    preConditions: [],
    postConditions: []
  };
}

describe("Plan Evaluation V2.1", () => {
  beforeEach(() => {
    __resetPlanEvaluationConfigForTests();
    __resetPlanEvaluationMetricsForTests();
    __resetPlanEvaluationStoreForTests();
  });

  it("expõe todos os validators configurados", () => {
    expect(PLAN_EVALUATION_VALIDATORS.length).toBe(14);
  });

  it("avalia plano saudável com score e approval", () => {
    const goal = analyzeGoal({
      text: "como funciona o produto?",
      companyId: 1
    });
    const plan = planFromGoal(goal);
    const report = evaluatePlan({ plan, goal, companyId: 1 });
    expect(report.id).toMatch(/^eval_/);
    expect(report.planId).toBe(plan.id);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.validationSummary.total).toBe(14);
    expect(report.metadata.executesTools).toBe(false);
    expect(report.metadata.executesPlan).toBe(false);
  });

  it("roda todos os validators e encontra issues em plano quebrado", () => {
    const goal = analyzeGoal({
      text: "transferir para humano",
      companyId: 2
    });
    const plan = brokenPlan(goal.id);
    const cfg = getPlanEvaluationConfig(2);
    const results = runAllValidators({ plan, goal, config: cfg });
    expect(results.length).toBe(14);
    expect(results.some(r => r.result === "FAIL")).toBe(true);
    const report = evaluatePlan({ plan, goal, companyId: 2 });
    expect(report.issues.length + report.warnings.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("Quality Score usa pesos da configuração (sem hardcode no engine)", () => {
    setPlanEvaluationConfig(3, {
      weights: {
        quality: 1,
        risk: 0,
        complexity: 0,
        consistency: 0,
        dependencyHealth: 0,
        entityHealth: 0,
        confirmationReadiness: 0
      }
    });
    const goal = analyzeGoal({ text: "buscar pedido 99", companyId: 3 });
    const plan = planFromGoal(goal);
    const cfg = getPlanEvaluationConfig(3);
    const results = runAllValidators({ plan, goal, config: cfg });
    const breakdown = computePlanScore({
      plan,
      goal,
      validatorResults: results,
      config: cfg
    });
    expect(breakdown.composite).toBe(breakdown.quality);
  });

  it("Approval levels determinísticos", () => {
    const goal = analyzeGoal({ text: "enviar mensagem", companyId: 4 });
    const plan = planFromGoal(goal);
    const cfg = getPlanEvaluationConfig(4);
    expect(
      decideApproval({
        score: 90,
        findings: [],
        plan,
        goal,
        config: cfg
      })
    ).toBe("APPROVED");
    expect(
      decideApproval({
        score: 70,
        findings: [
          {
            validator: "CostValidator",
            severity: "WARNING",
            result: "WARNING",
            message: "x",
            affectedSteps: [],
            recommendation: "y"
          }
        ],
        plan,
        goal,
        config: cfg
      })
    ).toBe("APPROVED_WITH_WARNINGS");
    expect(
      decideApproval({
        score: 10,
        findings: [
          {
            validator: "ImpossiblePlanValidator",
            severity: "CRITICAL",
            result: "FAIL",
            message: "x",
            affectedSteps: [],
            recommendation: "y"
          }
        ],
        plan,
        goal,
        config: cfg
      })
    ).toBe("REJECTED");
  });

  it("Recommendations deduplicam", () => {
    const recs = buildRecommendations([
      {
        validator: "a",
        severity: "WARNING",
        result: "WARNING",
        message: "m",
        affectedSteps: [],
        recommendation: "Remover etapa duplicada."
      },
      {
        validator: "b",
        severity: "WARNING",
        result: "WARNING",
        message: "m2",
        affectedSteps: [],
        recommendation: "Remover etapa duplicada."
      }
    ]);
    expect(recs).toEqual(["Remover etapa duplicada."]);
  });

  it("Plan Diff compara planos", async () => {
    const result = await DiffPlansService({
      companyId: 5,
      previousText: "como funciona?",
      nextText: "transferir para atendente"
    });
    expect(result.diff.previousPlanId).toBeTruthy();
    expect(result.diff.nextPlanId).toBeTruthy();
    expect(result.diff.scoreChange.to).not.toBeNull();
  });

  it("Replay inclui Evaluation", () => {
    const replay = replayCognitivePlan({
      companyId: 6,
      text: "agendar consulta amanhã"
    });
    expect(replay.evaluation).toBeTruthy();
    expect(replay.evaluation?.validatorResults.length).toBe(14);
    expect(replay.evaluation?.approval).toBeTruthy();
  });

  it("Dashboard / list / metrics / evaluate APIs services", async () => {
    await EvaluatePlanService({
      companyId: 7,
      text: "atualizar meu email a@b.com"
    });
    const list = await ListPlanEvaluationsService({ companyId: 7 });
    expect(list.records.length).toBeGreaterThan(0);
    const dash = await GetPlanEvaluationDashboardService({ companyId: 7 });
    expect(dash.guarantees.executesPlan).toBe(false);
    expect(dash.guarantees.liveUnchanged).toBe(true);
    expect(dash.metrics.plansEvaluated).toBeGreaterThan(0);
    const metrics = getPlanEvaluationMetrics(7);
    expect(metrics.averageQuality).toBeGreaterThanOrEqual(0);
  });

  it("detecta redundância e ciclo impossível", () => {
    const goal = analyzeGoal({ text: "custom task", companyId: 8 });
    const plan = planFromGoal(goal);
    plan.steps.push({
      ...plan.steps[0],
      id: "dup",
      type: plan.steps[0].type,
      objective: plan.steps[0].objective
    });
    const red = runAllValidators({
      plan,
      goal,
      config: getPlanEvaluationConfig(8)
    }).find(v => v.validator === "RedundancyValidator");
    expect(red?.result).toBe("WARNING");

    const cyclic: ExecutionPlan = {
      ...plan,
      steps: [
        {
          id: "a",
          type: "analyze",
          objective: "a",
          expectedResult: "a",
          requiredEntities: [],
          dependsOn: ["b"],
          optional: false,
          retryable: true,
          requiresConfirmation: false,
          status: "pending"
        },
        {
          id: "b",
          type: "custom",
          objective: "b",
          expectedResult: "b",
          requiredEntities: [],
          dependsOn: ["a"],
          optional: false,
          retryable: true,
          requiresConfirmation: false,
          status: "pending"
        }
      ]
    };
    const circ = runAllValidators({
      plan: cyclic,
      goal,
      config: getPlanEvaluationConfig(8)
    }).find(v => v.validator === "CircularDependencyValidator");
    expect(circ?.result).toBe("FAIL");
  });
});
