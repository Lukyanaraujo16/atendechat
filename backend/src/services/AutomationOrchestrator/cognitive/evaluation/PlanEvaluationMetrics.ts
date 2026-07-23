import { PlanEvaluationReport } from "./evaluationTypes";

type Metrics = {
  plansEvaluated: number;
  approved: number;
  rejected: number;
  qualitySum: number;
  complexitySum: number;
  riskSum: number;
  costSum: number;
  latencySum: number;
  validationFailures: number;
  warnings: number;
  criticals: number;
  byApproval: Record<string, number>;
  byValidatorFail: Record<string, number>;
};

const store = new Map<number, Metrics>();

function empty(): Metrics {
  return {
    plansEvaluated: 0,
    approved: 0,
    rejected: 0,
    qualitySum: 0,
    complexitySum: 0,
    riskSum: 0,
    costSum: 0,
    latencySum: 0,
    validationFailures: 0,
    warnings: 0,
    criticals: 0,
    byApproval: {},
    byValidatorFail: {}
  };
}

function riskNum(r: string): number {
  switch (r) {
    case "LOW":
      return 1;
    case "MEDIUM":
      return 2;
    case "HIGH":
      return 3;
    case "CRITICAL":
      return 4;
    default:
      return 1;
  }
}

function get(companyId: number): Metrics {
  let m = store.get(companyId);
  if (!m) {
    m = empty();
    store.set(companyId, m);
  }
  return m;
}

export function recordPlanEvaluation(input: {
  companyId: number;
  report: PlanEvaluationReport;
}): void {
  const m = get(input.companyId);
  const r = input.report;
  m.plansEvaluated += 1;
  m.qualitySum += r.quality;
  m.complexitySum += r.complexity;
  m.riskSum += riskNum(r.risk);
  m.costSum += r.estimatedCost;
  m.latencySum += r.estimatedLatency;
  m.byApproval[r.approval] = (m.byApproval[r.approval] || 0) + 1;
  if (r.approval === "APPROVED" || r.approval === "APPROVED_WITH_WARNINGS") {
    m.approved += 1;
  }
  if (r.approval === "REJECTED") {
    m.rejected += 1;
  }
  m.validationFailures += r.validationSummary.failed;
  m.warnings += r.warnings.length;
  m.criticals += r.issues.filter(i => i.severity === "CRITICAL").length;
  for (const v of r.validatorResults) {
    if (v.result === "FAIL") {
      m.byValidatorFail[v.validator] =
        (m.byValidatorFail[v.validator] || 0) + 1;
    }
  }
}

export function getPlanEvaluationMetrics(companyId: number) {
  const m = get(companyId);
  const n = m.plansEvaluated || 0;
  return {
    plansEvaluated: n,
    approvalRate: n ? Number((m.approved / n).toFixed(3)) : 0,
    rejectionRate: n ? Number((m.rejected / n).toFixed(3)) : 0,
    averageQuality: n ? Number((m.qualitySum / n).toFixed(2)) : 0,
    averageComplexity: n ? Number((m.complexitySum / n).toFixed(2)) : 0,
    averageRisk: n ? Number((m.riskSum / n).toFixed(2)) : 0,
    averageCost: n ? Number((m.costSum / n).toFixed(4)) : 0,
    averageLatency: n ? Math.round(m.latencySum / n) : 0,
    validationFailures: m.validationFailures,
    warningRate: n ? Number((m.warnings / n).toFixed(3)) : 0,
    criticalRate: n ? Number((m.criticals / n).toFixed(3)) : 0,
    byApproval: { ...m.byApproval },
    topFailingValidators: Object.entries(m.byValidatorFail)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([validator, count]) => ({ validator, count }))
  };
}

export function __resetPlanEvaluationMetricsForTests(): void {
  store.clear();
}

export default { recordPlanEvaluation, getPlanEvaluationMetrics };
