import { PlanEvaluationConfig } from "../../../../config/automationPlanEvaluationConstants";
import { buildDependencyGraph } from "../DependencyResolver";
import { ExecutionPlan, Goal } from "../types";
import { ValidationFinding, ValidatorRunResult } from "./evaluationTypes";

function finding(
  partial: Omit<ValidationFinding, "result"> & { result?: ValidationFinding["result"] }
): ValidationFinding {
  return {
    result:
      partial.severity === "CRITICAL" || partial.severity === "ERROR"
        ? "FAIL"
        : partial.severity === "WARNING"
          ? "WARNING"
          : "PASS",
    ...partial
  };
}

function aggregate(
  name: ValidatorRunResult["validator"],
  findings: ValidationFinding[]
): ValidatorRunResult {
  const hasFail = findings.some(f => f.result === "FAIL");
  const hasWarn = findings.some(f => f.result === "WARNING");
  return {
    validator: name,
    result: hasFail ? "FAIL" : hasWarn ? "WARNING" : "PASS",
    findings
  };
}

export function runDependencyValidator(plan: ExecutionPlan): ValidatorRunResult {
  const ids = new Set(plan.steps.map(s => s.id));
  const findings: ValidationFinding[] = [];
  for (const step of plan.steps) {
    for (const dep of step.dependsOn || []) {
      if (!ids.has(dep)) {
        findings.push(
          finding({
            validator: "DependencyValidator",
            severity: "ERROR",
            message: `Dependência inexistente: ${step.id} → ${dep}`,
            affectedSteps: [step.id],
            recommendation: `Remover dependência ${dep} ou adicionar a etapa.`
          })
        );
      }
    }
  }
  for (const edge of plan.dependencies || []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      findings.push(
        finding({
          validator: "DependencyValidator",
          severity: "ERROR",
          message: `Aresta quebrada ${edge.from}→${edge.to}`,
          affectedSteps: [edge.from, edge.to].filter(id => ids.has(id)),
          recommendation: "Sincronizar dependencies com steps."
        })
      );
    }
  }
  return aggregate("DependencyValidator", findings);
}

export function runCircularDependencyValidator(
  plan: ExecutionPlan
): ValidatorRunResult {
  const graph = buildDependencyGraph(plan.steps);
  const findings: ValidationFinding[] = [];
  if (graph.cycles.length) {
    findings.push(
      finding({
        validator: "CircularDependencyValidator",
        severity: "CRITICAL",
        message: `Dependência circular: ${graph.cycles.map(c => c.join("→")).join("; ")}`,
        affectedSteps: graph.cycles.flat(),
        recommendation: "Resolver dependência circular antes de aprovar."
      })
    );
  }
  return aggregate("CircularDependencyValidator", findings);
}

export function runOrphanStepValidator(plan: ExecutionPlan): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  if (plan.steps.length <= 1) {
    return aggregate("OrphanStepValidator", findings);
  }
  const connected = new Set<string>();
  for (const s of plan.steps) {
    for (const d of s.dependsOn || []) connected.add(d);
    if ((s.dependsOn || []).length) connected.add(s.id);
  }
  // roots without dependents and not referenced may be orphan if not entry
  const roots = plan.steps.filter(s => !(s.dependsOn || []).length);
  const referenced = new Set<string>();
  for (const s of plan.steps) {
    for (const d of s.dependsOn || []) referenced.add(d);
  }
  for (const s of plan.steps) {
    const isRoot = !(s.dependsOn || []).length;
    const hasChildren = plan.steps.some(o => (o.dependsOn || []).includes(s.id));
    if (!isRoot && !hasChildren && roots.length > 0) {
      // leaf is fine
      continue;
    }
    if (
      isRoot &&
      !hasChildren &&
      plan.steps.length > 1 &&
      roots.length > 1 &&
      !referenced.has(s.id)
    ) {
      // multiple disconnected roots — orphan-ish
      const othersHaveDeps = plan.steps.some(
        o => o.id !== s.id && (o.dependsOn || []).length > 0
      );
      if (othersHaveDeps) {
        findings.push(
          finding({
            validator: "OrphanStepValidator",
            severity: "WARNING",
            message: `Etapa órfã/desconectada: ${s.id}`,
            affectedSteps: [s.id],
            recommendation: "Conectar a etapa ao grafo ou removê-la."
          })
        );
      }
    }
  }
  return aggregate("OrphanStepValidator", findings);
}

export function runPreconditionValidator(plan: ExecutionPlan): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  const required = ["goal_analyzed", "no_tool_execution"];
  for (const pc of required) {
    if (!(plan.preConditions || []).includes(pc)) {
      findings.push(
        finding({
          validator: "PreconditionValidator",
          severity: "ERROR",
          message: `Pré-condição obrigatória ausente: ${pc}`,
          affectedSteps: [],
          recommendation: `Adicionar preCondition "${pc}".`
        })
      );
    }
  }
  return aggregate("PreconditionValidator", findings);
}

export function runPostconditionValidator(plan: ExecutionPlan): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  const required = ["tools_not_invoked_by_planner"];
  for (const pc of required) {
    if (!(plan.postConditions || []).includes(pc)) {
      findings.push(
        finding({
          validator: "PostconditionValidator",
          severity: "WARNING",
          message: `Pós-condição recomendada ausente: ${pc}`,
          affectedSteps: [],
          recommendation: `Adicionar postCondition "${pc}".`
        })
      );
    }
  }
  if (!(plan.postConditions || []).length) {
    findings.push(
      finding({
        validator: "PostconditionValidator",
        severity: "WARNING",
        message: "Plano sem pós-condições.",
        affectedSteps: [],
        recommendation: "Definir postConditions explícitas."
      })
    );
  }
  return aggregate("PostconditionValidator", findings);
}

export function runEntityValidator(
  plan: ExecutionPlan,
  goal: Goal
): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  const available = new Set(goal.entities.map(e => e.key));
  for (const step of plan.steps) {
    for (const key of step.requiredEntities || []) {
      if (!available.has(key)) {
        findings.push(
          finding({
            validator: "EntityValidator",
            severity: "WARNING",
            message: `Entidade obrigatória ausente no Goal: ${key} (step ${step.id})`,
            affectedSteps: [step.id],
            recommendation: `Adicionar entidade obrigatória "${key}".`
          })
        );
      }
    }
  }
  return aggregate("EntityValidator", findings);
}

export function runConfirmationValidator(
  plan: ExecutionPlan,
  goal: Goal
): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  const riskyTypes = new Set([
    "transfer",
    "send_message",
    "update_entity",
    "automation"
  ]);
  for (const step of plan.steps) {
    if (riskyTypes.has(step.type) && !step.requiresConfirmation) {
      findings.push(
        finding({
          validator: "ConfirmationValidator",
          severity: "ERROR",
          message: `Etapa de risco ${step.id} (${step.type}) sem confirmação`,
          affectedSteps: [step.id],
          recommendation: `Adicionar confirmação antes da etapa ${step.id}.`
        })
      );
    }
  }
  if (goal.requiresConfirmation) {
    const hasConfirm = plan.steps.some(
      s => s.type === "confirm" || s.requiresConfirmation
    );
    if (!hasConfirm) {
      findings.push(
        finding({
          validator: "ConfirmationValidator",
          severity: "ERROR",
          message: "Goal exige confirmação, mas o plano não possui etapa confirmável",
          affectedSteps: plan.steps.map(s => s.id),
          recommendation: "Incluir etapa confirm ou requiresConfirmation."
        })
      );
    }
  }
  return aggregate("ConfirmationValidator", findings);
}

export function runRiskValidator(
  plan: ExecutionPlan,
  goal: Goal,
  cfg: PlanEvaluationConfig
): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  const risk = (plan.estimatedRisk || goal.riskLevel || "low").toLowerCase();
  if (risk === "critical") {
    findings.push(
      finding({
        validator: "RiskValidator",
        severity: "CRITICAL",
        message: "Risco CRITICAL no plano",
        affectedSteps: plan.steps.filter(s => s.requiresConfirmation).map(s => s.id),
        recommendation: "Exigir confirmação humana e revisar escopo."
      })
    );
  } else if (risk === "high") {
    findings.push(
      finding({
        validator: "RiskValidator",
        severity: "WARNING",
        message: "Risco HIGH no plano",
        affectedSteps: [],
        recommendation: "Validar confirmações e restrições antes de aprovar."
      })
    );
  }
  if (cfg.riskScores[risk as keyof typeof cfg.riskScores] == null && risk) {
    findings.push(
      finding({
        validator: "RiskValidator",
        severity: "WARNING",
        message: `Nível de risco desconhecido: ${risk}`,
        affectedSteps: [],
        recommendation: "Normalizar estimatedRisk para low|medium|high|critical."
      })
    );
  }
  return aggregate("RiskValidator", findings);
}

export function runComplexityValidator(
  plan: ExecutionPlan,
  cfg: PlanEvaluationConfig
): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  if (plan.estimatedComplexity > cfg.thresholds.maxComplexity) {
    findings.push(
      finding({
        validator: "ComplexityValidator",
        severity: "WARNING",
        message: `Complexidade ${plan.estimatedComplexity} > limiar ${cfg.thresholds.maxComplexity}`,
        affectedSteps: plan.steps.map(s => s.id),
        recommendation: "Dividir plano em dois."
      })
    );
  }
  if (plan.steps.length > cfg.thresholds.maxComplexity + 2) {
    findings.push(
      finding({
        validator: "ComplexityValidator",
        severity: "WARNING",
        message: `Número elevado de etapas: ${plan.steps.length}`,
        affectedSteps: [],
        recommendation: "Simplificar ou fatiar o plano."
      })
    );
  }
  return aggregate("ComplexityValidator", findings);
}

export function runCostValidator(
  plan: ExecutionPlan,
  cfg: PlanEvaluationConfig
): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  if (plan.estimatedCost > cfg.thresholds.maxCost) {
    findings.push(
      finding({
        validator: "CostValidator",
        severity: "WARNING",
        message: `Custo estimado ${plan.estimatedCost} > ${cfg.thresholds.maxCost}`,
        affectedSteps: [],
        recommendation: "Reduzir estimatedToolCalls / etapas caras."
      })
    );
  }
  return aggregate("CostValidator", findings);
}

export function runLatencyValidator(
  plan: ExecutionPlan,
  cfg: PlanEvaluationConfig
): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  if (plan.estimatedLatency > cfg.thresholds.maxLatencyMs) {
    findings.push(
      finding({
        validator: "LatencyValidator",
        severity: "WARNING",
        message: `Latência estimada ${plan.estimatedLatency}ms > ${cfg.thresholds.maxLatencyMs}ms`,
        affectedSteps: [],
        recommendation: "Reduzir etapas ou permitir paralelismo futuro."
      })
    );
  }
  return aggregate("LatencyValidator", findings);
}

export function runRedundancyValidator(plan: ExecutionPlan): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  const seen = new Map<string, string>();
  for (const step of plan.steps) {
    const key = `${step.type}|${step.objective.trim().toLowerCase()}`;
    if (seen.has(key)) {
      findings.push(
        finding({
          validator: "RedundancyValidator",
          severity: "WARNING",
          message: `Etapa duplicada: ${step.id} ≈ ${seen.get(key)}`,
          affectedSteps: [seen.get(key)!, step.id],
          recommendation: "Remover etapa duplicada."
        })
      );
    } else {
      seen.set(key, step.id);
    }
  }
  return aggregate("RedundancyValidator", findings);
}

export function runImpossiblePlanValidator(
  plan: ExecutionPlan
): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  if (!plan.steps.length) {
    findings.push(
      finding({
        validator: "ImpossiblePlanValidator",
        severity: "CRITICAL",
        message: "Plano sem etapas — impossível executar",
        affectedSteps: [],
        recommendation: "Gerar plano com ao menos uma etapa."
      })
    );
  }
  const graph = buildDependencyGraph(plan.steps);
  if (graph.cycles.length) {
    findings.push(
      finding({
        validator: "ImpossiblePlanValidator",
        severity: "CRITICAL",
        message: "Ciclo torna o plano impossível",
        affectedSteps: graph.cycles.flat(),
        recommendation: "Resolver dependência circular."
      })
    );
  }
  if (graph.order.length < plan.steps.length) {
    findings.push(
      finding({
        validator: "ImpossiblePlanValidator",
        severity: "CRITICAL",
        message: "Nem todas as etapas são alcançáveis na ordenação",
        affectedSteps: plan.steps
          .map(s => s.id)
          .filter(id => !graph.order.includes(id)),
        recommendation: "Corrigir grafo de dependências."
      })
    );
  }
  return aggregate("ImpossiblePlanValidator", findings);
}

export function runPlannerConsistencyValidator(
  plan: ExecutionPlan,
  goal: Goal
): ValidatorRunResult {
  const findings: ValidationFinding[] = [];
  if (plan.goalId !== goal.id) {
    findings.push(
      finding({
        validator: "PlannerConsistencyValidator",
        severity: "ERROR",
        message: `goalId do plano (${plan.goalId}) ≠ Goal (${goal.id})`,
        affectedSteps: [],
        recommendation: "Regenerar plano a partir do Goal atual."
      })
    );
  }
  const outcomeHint = (goal.requestedOutcome || "").toLowerCase();
  const stepText = plan.steps
    .map(s => `${s.objective} ${s.expectedResult}`)
    .join(" ")
    .toLowerCase();
  if (
    goal.type === "TRANSFER_TICKET" &&
    !plan.steps.some(s => s.type === "transfer")
  ) {
    findings.push(
      finding({
        validator: "PlannerConsistencyValidator",
        severity: "ERROR",
        message: "Goal TRANSFER_TICKET sem etapa transfer",
        affectedSteps: [],
        recommendation: "Incluir etapa transfer compatível com o Goal."
      })
    );
  }
  if (
    goal.type === "SEND_MESSAGE" &&
    !plan.steps.some(s => s.type === "send_message")
  ) {
    findings.push(
      finding({
        validator: "PlannerConsistencyValidator",
        severity: "ERROR",
        message: "Goal SEND_MESSAGE sem etapa send_message",
        affectedSteps: [],
        recommendation: "Incluir etapa send_message."
      })
    );
  }
  if (outcomeHint && stepText && outcomeHint.length > 8) {
    const tokens = outcomeHint.split(/\s+/).filter(t => t.length > 4).slice(0, 3);
    const hit = tokens.some(t => stepText.includes(t));
    if (!hit && tokens.length) {
      findings.push(
        finding({
          validator: "PlannerConsistencyValidator",
          severity: "WARNING",
          message: "Resultado esperado do Goal pouco refletido nas etapas",
          affectedSteps: [],
          recommendation: "Alinhar expectedResult das etapas ao requestedOutcome."
        })
      );
    }
  }
  return aggregate("PlannerConsistencyValidator", findings);
}

export function runAllValidators(input: {
  plan: ExecutionPlan;
  goal: Goal;
  config: PlanEvaluationConfig;
}): ValidatorRunResult[] {
  const { plan, goal, config } = input;
  return [
    runDependencyValidator(plan),
    runCircularDependencyValidator(plan),
    runOrphanStepValidator(plan),
    runPreconditionValidator(plan),
    runPostconditionValidator(plan),
    runEntityValidator(plan, goal),
    runConfirmationValidator(plan, goal),
    runRiskValidator(plan, goal, config),
    runComplexityValidator(plan, config),
    runCostValidator(plan, config),
    runLatencyValidator(plan, config),
    runRedundancyValidator(plan),
    runImpossiblePlanValidator(plan),
    runPlannerConsistencyValidator(plan, goal)
  ];
}

export default { runAllValidators };
