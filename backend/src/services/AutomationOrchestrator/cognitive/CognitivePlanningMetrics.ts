import { GoalRiskLevel } from "../../../config/automationCognitivePlanningConstants";

type Metrics = {
  plansGenerated: number;
  stepsSum: number;
  complexitySum: number;
  riskSum: number;
  latencySum: number;
  recoveries: number;
  validationFailures: number;
  byGoalType: Record<string, number>;
  byRisk: Record<string, number>;
};

const store = new Map<number, Metrics>();

function empty(): Metrics {
  return {
    plansGenerated: 0,
    stepsSum: 0,
    complexitySum: 0,
    riskSum: 0,
    latencySum: 0,
    recoveries: 0,
    validationFailures: 0,
    byGoalType: {},
    byRisk: {}
  };
}

function get(companyId: number): Metrics {
  let m = store.get(companyId);
  if (!m) {
    m = empty();
    store.set(companyId, m);
  }
  return m;
}

function riskScore(r: GoalRiskLevel): number {
  switch (r) {
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    case "critical":
      return 4;
    default:
      return 1;
  }
}

export function recordPlanGenerated(input: {
  companyId: number;
  steps: number;
  complexity: number;
  risk: GoalRiskLevel;
  latencyMs: number;
  goalType?: string;
}): void {
  const m = get(input.companyId);
  m.plansGenerated += 1;
  m.stepsSum += input.steps;
  m.complexitySum += input.complexity;
  m.riskSum += riskScore(input.risk);
  m.latencySum += Math.max(0, input.latencyMs);
  m.byRisk[input.risk] = (m.byRisk[input.risk] || 0) + 1;
  if (input.goalType) {
    m.byGoalType[input.goalType] = (m.byGoalType[input.goalType] || 0) + 1;
  }
  try {
    // Wave 3 observability side-effect only
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { observeAgentOsStep } = require("../observability/observeAgentOsStep");
    observeAgentOsStep({
      companyId: input.companyId,
      origin: "planner",
      type: "planner.plan_generated",
      latencyMs: input.latencyMs,
      success: true,
      finish: true
    });
  } catch {
    /* fail-open */
  }
}

export function recordValidationFailures(
  companyId: number,
  n = 1
): void {
  get(companyId).validationFailures += n;
}

export function recordRecovery(companyId: number, n = 1): void {
  get(companyId).recoveries += n;
}

export function getCognitivePlanningMetrics(companyId: number) {
  const m = get(companyId);
  const n = m.plansGenerated || 0;
  return {
    plansGenerated: n,
    averageSteps: n ? Number((m.stepsSum / n).toFixed(2)) : 0,
    averageComplexity: n ? Number((m.complexitySum / n).toFixed(2)) : 0,
    averageRisk: n ? Number((m.riskSum / n).toFixed(2)) : 0,
    averageLatency: n ? Math.round(m.latencySum / n) : 0,
    recoveryRate: n ? Number((m.recoveries / n).toFixed(3)) : 0,
    validationFailures: m.validationFailures,
    recoveries: m.recoveries,
    byGoalType: { ...m.byGoalType },
    byRisk: { ...m.byRisk }
  };
}

export function __resetCognitivePlanningMetricsForTests(): void {
  store.clear();
}

export default {
  recordPlanGenerated,
  getCognitivePlanningMetrics
};
