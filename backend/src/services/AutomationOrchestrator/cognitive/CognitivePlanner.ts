import { createHash } from "crypto";
import {
  AUTOMATION_COGNITIVE_PLANNING_VERSION,
  GoalRiskLevel,
  GoalType
} from "../../../config/automationCognitivePlanningConstants";
import { Goal, ExecutionPlan, ExecutionStep } from "./types";
import { buildDependencyGraph } from "./DependencyResolver";

function step(
  partial: Omit<ExecutionStep, "status"> & { status?: ExecutionStep["status"] }
): ExecutionStep {
  return { status: "pending", ...partial };
}

function stepsForGoal(goal: Goal): ExecutionStep[] {
  const confirm = goal.requiresConfirmation;
  const templates: Record<GoalType, ExecutionStep[]> = {
    ANSWER_QUESTION: [
      step({
        id: "s1",
        type: "analyze",
        objective: "Interpretar a pergunta",
        expectedResult: "Pergunta estruturada",
        requiredEntities: [],
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "gather_context",
        objective: "Coletar contexto do ticket/contato",
        expectedResult: "Contexto disponível",
        requiredEntities: [],
        dependsOn: ["s1"],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s3",
        type: "compose_answer",
        objective: "Compor resposta",
        expectedResult: "Texto de resposta",
        requiredEntities: [],
        dependsOn: ["s2"],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      })
    ],
    SEARCH_INFORMATION: [
      step({
        id: "s1",
        type: "analyze",
        objective: "Extrair termos de busca",
        expectedResult: "Query estruturada",
        requiredEntities: [],
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "search",
        objective: "Planejar busca de informação",
        expectedResult: "Fontes candidatas identificadas",
        requiredEntities: goal.entities.map(e => e.key),
        dependsOn: ["s1"],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s3",
        type: "compose_answer",
        objective: "Sintetizar achados",
        expectedResult: "Resumo factual",
        requiredEntities: [],
        dependsOn: ["s2"],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      })
    ],
    UPDATE_CONTACT: [
      step({
        id: "s1",
        type: "analyze",
        objective: "Identificar campos a atualizar",
        expectedResult: "Campos e valores",
        requiredEntities: ["name", "email", "phone"].filter(k =>
          goal.entities.some(e => e.key === k)
        ),
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "confirm",
        objective: "Confirmar alteração de contato",
        expectedResult: "Confirmação do usuário",
        requiredEntities: [],
        dependsOn: ["s1"],
        optional: false,
        retryable: false,
        requiresConfirmation: true
      }),
      step({
        id: "s3",
        type: "update_entity",
        objective: "Planejar update do contato",
        expectedResult: "Payload de update (não executado)",
        requiredEntities: [],
        dependsOn: ["s2"],
        optional: false,
        retryable: true,
        requiresConfirmation: confirm
      })
    ],
    TRANSFER_TICKET: [
      step({
        id: "s1",
        type: "analyze",
        objective: "Validar motivo da transferência",
        expectedResult: "Motivo claro",
        requiredEntities: [],
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "confirm",
        objective: "Confirmar handoff",
        expectedResult: "Confirmação",
        requiredEntities: [],
        dependsOn: ["s1"],
        optional: true,
        retryable: false,
        requiresConfirmation: true
      }),
      step({
        id: "s3",
        type: "transfer",
        objective: "Planejar transferência do ticket",
        expectedResult: "Alvo de transferência definido",
        requiredEntities: [],
        dependsOn: ["s1", "s2"],
        optional: false,
        retryable: true,
        requiresConfirmation: true
      })
    ],
    SEND_MESSAGE: [
      step({
        id: "s1",
        type: "compose_answer",
        objective: "Compor mensagem a enviar",
        expectedResult: "Texto da mensagem",
        requiredEntities: [],
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "confirm",
        objective: "Confirmar envio",
        expectedResult: "Aprovação",
        requiredEntities: [],
        dependsOn: ["s1"],
        optional: false,
        retryable: false,
        requiresConfirmation: true
      }),
      step({
        id: "s3",
        type: "send_message",
        objective: "Planejar envio (sem executar)",
        expectedResult: "Intent de envio",
        requiredEntities: [],
        dependsOn: ["s2"],
        optional: false,
        retryable: true,
        requiresConfirmation: true
      })
    ],
    EXECUTE_AUTOMATION: [
      step({
        id: "s1",
        type: "analyze",
        objective: "Identificar automação solicitada",
        expectedResult: "Automation id/nome",
        requiredEntities: [],
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "confirm",
        objective: "Confirmar execução de automação",
        expectedResult: "Confirmação",
        requiredEntities: [],
        dependsOn: ["s1"],
        optional: false,
        retryable: false,
        requiresConfirmation: true
      }),
      step({
        id: "s3",
        type: "automation",
        objective: "Planejar disparo de automação",
        expectedResult: "Plano de automação (não executado)",
        requiredEntities: [],
        dependsOn: ["s2"],
        optional: false,
        retryable: true,
        requiresConfirmation: true
      })
    ],
    SCHEDULE_EVENT: [
      step({
        id: "s1",
        type: "analyze",
        objective: "Extrair data/hora/assunto",
        expectedResult: "Campos de agenda",
        requiredEntities: [],
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "schedule",
        objective: "Montar proposta de agendamento",
        expectedResult: "Slot proposto",
        requiredEntities: [],
        dependsOn: ["s1"],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s3",
        type: "confirm",
        objective: "Confirmar agendamento",
        expectedResult: "Confirmação",
        requiredEntities: [],
        dependsOn: ["s2"],
        optional: false,
        retryable: false,
        requiresConfirmation: true
      })
    ],
    MULTI_STEP_TASK: [
      step({
        id: "s1",
        type: "analyze",
        objective: "Decompor tarefa multi-etapas",
        expectedResult: "Subtarefas",
        requiredEntities: [],
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "gather_context",
        objective: "Coletar contexto necessário",
        expectedResult: "Contexto",
        requiredEntities: [],
        dependsOn: ["s1"],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s3",
        type: "search",
        objective: "Planejar coleta de informações",
        expectedResult: "Dados intermediários",
        requiredEntities: [],
        dependsOn: ["s1"],
        optional: true,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s4",
        type: "compose_answer",
        objective: "Consolidar resultado",
        expectedResult: "Resultado final planejado",
        requiredEntities: [],
        dependsOn: ["s2", "s3"],
        optional: false,
        retryable: true,
        requiresConfirmation: confirm
      })
    ],
    CUSTOM: [
      step({
        id: "s1",
        type: "analyze",
        objective: "Interpretar objetivo custom",
        expectedResult: "Objetivo clarificado",
        requiredEntities: [],
        dependsOn: [],
        optional: false,
        retryable: true,
        requiresConfirmation: false
      }),
      step({
        id: "s2",
        type: "custom",
        objective: goal.objective.slice(0, 160),
        expectedResult: goal.requestedOutcome,
        requiredEntities: goal.entities.map(e => e.key),
        dependsOn: ["s1"],
        optional: false,
        retryable: true,
        requiresConfirmation: confirm
      })
    ]
  };

  return templates[goal.type] || templates.CUSTOM;
}

function complexity(steps: ExecutionStep[]): number {
  return Math.min(
    10,
    steps.length + steps.filter(s => s.dependsOn.length > 1).length
  );
}

function estimateRisk(goal: Goal, steps: ExecutionStep[]): GoalRiskLevel {
  if (goal.riskLevel === "critical") return "critical";
  if (steps.some(s => s.requiresConfirmation) && goal.riskLevel === "high") {
    return "high";
  }
  return goal.riskLevel;
}

/**
 * CognitivePlanner — Goal → ExecutionPlan.
 * NÃO executa Tools. NÃO conhece providers/runtime.
 */
export function planFromGoal(goal: Goal): ExecutionPlan {
  const steps = stepsForGoal(goal);
  const graph = buildDependencyGraph(steps);
  const id = createHash("sha256")
    .update(`${goal.id}:${AUTOMATION_COGNITIVE_PLANNING_VERSION}:${Date.now()}`)
    .digest("hex")
    .slice(0, 20);

  const estimatedToolCalls = steps.filter(s =>
    ["search", "update_entity", "transfer", "send_message", "automation", "schedule"].includes(
      s.type
    )
  ).length;

  return {
    id: `plan_${id}`,
    goalId: goal.id,
    version: AUTOMATION_COGNITIVE_PLANNING_VERSION,
    steps,
    dependencies: graph.edges,
    preConditions: [
      "goal_analyzed",
      "no_tool_execution",
      ...goal.constraints.slice(0, 3)
    ],
    postConditions: [
      "plan_ready_for_executor",
      "tools_not_invoked_by_planner"
    ],
    estimatedComplexity: complexity(steps),
    estimatedRisk: estimateRisk(goal, steps),
    estimatedToolCalls,
    estimatedCost: Number((estimatedToolCalls * 0.002).toFixed(4)),
    estimatedLatency: 80 + steps.length * 40,
    status: "ready",
    parallelGroups: graph.parallelGroups,
    createdAt: new Date().toISOString(),
    metadata: {
      planner: "CognitivePlanner",
      executesTools: false,
      knowsProviders: false,
      knowsToolRuntime: false
    }
  };
}

export default { planFromGoal };
