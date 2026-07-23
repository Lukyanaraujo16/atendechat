import { GOAL_TYPES, AUTOMATION_COGNITIVE_PLANNING_VERSION } from "../../../config/automationCognitivePlanningConstants";
import { analyzeGoal } from "./GoalAnalyzer";
import { planFromGoal } from "./CognitivePlanner";
import { buildDependencyGraph, getReadySteps } from "./DependencyResolver";
import { validatePlanSteps } from "./ValidationEngine";
import { buildRecoveryForValidations } from "./RecoveryEngine";
import { replayCognitivePlan } from "./PlanReplay";
import {
  getCognitivePlanningMetrics,
  recordPlanGenerated
} from "./CognitivePlanningMetrics";
import {
  Goal,
  ExecutionPlan,
  PlanReplayRecord,
  RecoveryPlan,
  StepValidation
} from "./types";

const MAX_STORE = 200;

type CompanyStore = {
  goals: Goal[];
  plans: ExecutionPlan[];
  replays: PlanReplayRecord[];
  validations: StepValidation[];
  recoveries: RecoveryPlan[];
};

const byCompany = new Map<number, CompanyStore>();

function store(companyId: number): CompanyStore {
  let s = byCompany.get(companyId);
  if (!s) {
    s = { goals: [], plans: [], replays: [], validations: [], recoveries: [] };
    byCompany.set(companyId, s);
  }
  return s;
}

function pushCap<T>(arr: T[], item: T): void {
  arr.unshift(item);
  if (arr.length > MAX_STORE) arr.length = MAX_STORE;
}

export async function GetCognitivePlanningDashboardService(input: {
  companyId: number;
}) {
  const s = store(input.companyId);
  const metrics = getCognitivePlanningMetrics(input.companyId);
  return {
    version: AUTOMATION_COGNITIVE_PLANNING_VERSION,
    goalTypes: GOAL_TYPES,
    metrics,
    recentGoals: s.goals.slice(0, 20),
    recentPlans: s.plans.slice(0, 20),
    recentReplays: s.replays.slice(0, 10),
    recentValidations: s.validations.slice(0, 30),
    recentRecoveries: s.recoveries.slice(0, 20),
    guarantees: {
      plannerExecutesTools: false,
      plannerKnowsProviders: false,
      plannerKnowsToolRuntime: false,
      livePipelineUnchanged: true,
      shadowPipelineUnchanged: true
    }
  };
}

export async function AnalyzeGoalService(input: {
  companyId: number;
  text: string;
  ticketId?: number;
  contactId?: number;
}) {
  const goal = analyzeGoal({
    text: input.text,
    companyId: input.companyId,
    ticketId: input.ticketId,
    contactId: input.contactId
  });
  pushCap(store(input.companyId).goals, goal);
  return { goal };
}

export async function GeneratePlanService(input: {
  companyId: number;
  text?: string;
  goal?: Goal;
}) {
  const goal =
    input.goal ||
    analyzeGoal({
      text: input.text || "",
      companyId: input.companyId
    });
  const plan = planFromGoal(goal);
  recordPlanGenerated({
    companyId: input.companyId,
    steps: plan.steps.length,
    complexity: plan.estimatedComplexity,
    risk: plan.estimatedRisk,
    latencyMs: plan.estimatedLatency,
    goalType: goal.type
  });
  const s = store(input.companyId);
  pushCap(s.goals, goal);
  pushCap(s.plans, plan);
  const graph = buildDependencyGraph(plan.steps);
  return { goal, plan, dependencyOrder: graph.order, parallelGroups: graph.parallelGroups };
}

export async function InspectDependenciesService(input: {
  companyId: number;
  planId?: string;
  text?: string;
}) {
  let plan = store(input.companyId).plans.find(p => p.id === input.planId);
  let goal: Goal | undefined;
  if (!plan) {
    const generated = await GeneratePlanService({
      companyId: input.companyId,
      text: input.text || "consultar status do pedido"
    });
    plan = generated.plan;
    goal = generated.goal;
  }
  const graph = buildDependencyGraph(plan.steps);
  const ready = getReadySteps(plan.steps, new Set());
  return {
    goal: goal || null,
    plan,
    edges: graph.edges,
    order: graph.order,
    parallelGroups: graph.parallelGroups,
    cycles: graph.cycles,
    readyStepIds: ready.map(s => s.id),
    note: "Paralelismo planejado apenas — execução paralela ainda não habilitada."
  };
}

export async function SimulateValidationService(input: {
  companyId: number;
  text?: string;
  planId?: string;
  outcomes?: Record<string, any>;
}) {
  const gen = await GeneratePlanService({
    companyId: input.companyId,
    text: input.text || "quero falar com um atendente"
  });
  const validations = validatePlanSteps(gen.plan.steps, input.outcomes);
  const s = store(input.companyId);
  for (const v of validations) pushCap(s.validations, v);
  return { goal: gen.goal, plan: gen.plan, validations };
}

export async function SimulateRecoveryService(input: {
  companyId: number;
  text?: string;
  outcomes?: Record<string, any>;
}) {
  const gen = await GeneratePlanService({
    companyId: input.companyId,
    text: input.text || "atualizar meu email teste@exemplo.com"
  });
  const outcomes = input.outcomes || {
    s2: { partial: true, note: "awaiting_confirmation" },
    s3: { success: false, note: "simulated_failure" }
  };
  const validations = validatePlanSteps(gen.plan.steps, outcomes);
  const recoveries = buildRecoveryForValidations({
    plan: gen.plan,
    validations
  });
  const s = store(input.companyId);
  for (const v of validations) pushCap(s.validations, v);
  for (const r of recoveries) pushCap(s.recoveries, r);
  return {
    goal: gen.goal,
    plan: gen.plan,
    validations,
    recoveries,
    note: "Recovery Plan gerado apenas — autoExecute=false"
  };
}

export async function ReplayPlanService(input: {
  companyId: number;
  text: string;
  ticketId?: number;
  contactId?: number;
  simulatedOutcomes?: Record<string, any>;
}) {
  const replay = replayCognitivePlan({
    companyId: input.companyId,
    text: input.text,
    ticketId: input.ticketId,
    contactId: input.contactId,
    simulatedOutcomes: input.simulatedOutcomes
  });
  const s = store(input.companyId);
  pushCap(s.replays, replay);
  pushCap(s.goals, replay.goal);
  pushCap(s.plans, replay.plan);
  for (const v of replay.validations) pushCap(s.validations, v);
  for (const r of replay.recoveries) pushCap(s.recoveries, r);
  return { replay };
}

export async function GetCognitivePlanningMetricsService(input: {
  companyId: number;
}) {
  const { GetPlanEvaluationMetricsService } = await import(
    "./evaluation/PlanEvaluationAdminServices"
  );
  const evaluation = await GetPlanEvaluationMetricsService({
    companyId: input.companyId
  });
  return {
    version: AUTOMATION_COGNITIVE_PLANNING_VERSION,
    metrics: getCognitivePlanningMetrics(input.companyId),
    evaluation: evaluation.evaluation,
    evaluationConfig: evaluation.config
  };
}

export function __resetCognitivePlanningStoreForTests(): void {
  byCompany.clear();
}

export default {
  GetCognitivePlanningDashboardService,
  AnalyzeGoalService,
  GeneratePlanService,
  ReplayPlanService
};
