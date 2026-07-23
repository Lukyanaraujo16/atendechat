import { AUTOMATION_PLAN_EVALUATION_VERSION } from "../../../../config/automationPlanEvaluationConstants";
import { analyzeGoal } from "../GoalAnalyzer";
import { planFromGoal } from "../CognitivePlanner";
import { ExecutionPlan, Goal } from "../types";
import { evaluatePlan } from "./PlanEvaluationEngine";
import { diffPlans } from "./PlanDiff";
import {
  getPlanEvaluationConfig,
  setPlanEvaluationConfig
} from "./PlanEvaluationConfig";
import { getPlanEvaluationMetrics } from "./PlanEvaluationMetrics";
import { PlanEvaluationReport, PlanDiffResult } from "./evaluationTypes";

const MAX = 200;

type Store = {
  evaluations: PlanEvaluationReport[];
  diffs: PlanDiffResult[];
};

const byCompany = new Map<number, Store>();

function store(companyId: number): Store {
  let s = byCompany.get(companyId);
  if (!s) {
    s = { evaluations: [], diffs: [] };
    byCompany.set(companyId, s);
  }
  return s;
}

function pushCap<T>(arr: T[], item: T): void {
  arr.unshift(item);
  if (arr.length > MAX) arr.length = MAX;
}

export async function GetPlanEvaluationDashboardService(input: {
  companyId: number;
}) {
  const s = store(input.companyId);
  const metrics = getPlanEvaluationMetrics(input.companyId);
  const recent = s.evaluations.slice(0, 30);
  const topProblems = recent
    .flatMap(e => e.issues.concat(e.warnings))
    .reduce<Record<string, number>>((acc, f) => {
      acc[f.message] = (acc[f.message] || 0) + 1;
      return acc;
    }, {});
  const recommendations = recent
    .flatMap(e => e.recommendations)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 15);

  return {
    version: AUTOMATION_PLAN_EVALUATION_VERSION,
    metrics,
    config: getPlanEvaluationConfig(input.companyId),
    recentEvaluations: recent.slice(0, 15),
    topValidators: metrics.topFailingValidators,
    topProblems: Object.entries(topProblems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message, count })),
    recommendations,
    guarantees: {
      executesPlan: false,
      executesTools: false,
      liveUnchanged: true,
      shadowUnchanged: true,
      plannerUnmodified: true
    }
  };
}

export async function EvaluatePlanService(input: {
  companyId: number;
  text?: string;
  goal?: Goal;
  plan?: ExecutionPlan;
}) {
  const goal =
    input.goal ||
    analyzeGoal({
      text: input.text || "",
      companyId: input.companyId
    });
  const plan = input.plan || planFromGoal(goal);
  const report = evaluatePlan({
    plan,
    goal,
    companyId: input.companyId
  });
  pushCap(store(input.companyId).evaluations, report);
  return { goal, plan, evaluation: report };
}

export async function ListPlanEvaluationsService(input: {
  companyId: number;
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, input.limit || 20));
  return {
    version: AUTOMATION_PLAN_EVALUATION_VERSION,
    records: store(input.companyId).evaluations.slice(0, limit)
  };
}

export async function GetPlanEvaluationService(input: {
  companyId: number;
  id: string;
}) {
  const found = store(input.companyId).evaluations.find(e => e.id === input.id);
  if (!found) {
    return { evaluation: null };
  }
  return { evaluation: found };
}

export async function GetPlanEvaluationMetricsService(input: {
  companyId: number;
}) {
  return {
    version: AUTOMATION_PLAN_EVALUATION_VERSION,
    evaluation: getPlanEvaluationMetrics(input.companyId),
    config: getPlanEvaluationConfig(input.companyId)
  };
}

export async function UpsertPlanEvaluationConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  const saved = setPlanEvaluationConfig(input.companyId, input.config);
  return { config: saved };
}

export async function DiffPlansService(input: {
  companyId: number;
  previousText?: string;
  nextText?: string;
  previousPlan?: ExecutionPlan;
  nextPlan?: ExecutionPlan;
  previousGoal?: Goal;
  nextGoal?: Goal;
}) {
  const prevGoal =
    input.previousGoal ||
    analyzeGoal({
      text: input.previousText || "consultar status",
      companyId: input.companyId
    });
  const nextGoal =
    input.nextGoal ||
    analyzeGoal({
      text: input.nextText || input.previousText || "transferir para atendente",
      companyId: input.companyId
    });
  const previous = input.previousPlan || planFromGoal(prevGoal);
  const next = input.nextPlan || planFromGoal(nextGoal);
  const prevEval = evaluatePlan({
    plan: previous,
    goal: prevGoal,
    companyId: input.companyId
  });
  const nextEval = evaluatePlan({
    plan: next,
    goal: nextGoal,
    companyId: input.companyId
  });
  pushCap(store(input.companyId).evaluations, prevEval);
  pushCap(store(input.companyId).evaluations, nextEval);
  const diff = diffPlans({
    previous,
    next,
    previousScore: prevEval.score,
    nextScore: nextEval.score,
    previousApproval: prevEval.approval,
    nextApproval: nextEval.approval
  });
  pushCap(store(input.companyId).diffs, diff);
  return {
    previous: { goal: prevGoal, plan: previous, evaluation: prevEval },
    next: { goal: nextGoal, plan: next, evaluation: nextEval },
    diff
  };
}

export function __resetPlanEvaluationStoreForTests(): void {
  byCompany.clear();
}

export default {
  GetPlanEvaluationDashboardService,
  EvaluatePlanService,
  ListPlanEvaluationsService
};
