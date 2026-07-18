import { AUTOMATION_PLANNER_VERSION } from "../../config/automationOrchestratorConstants";
import { classifyIntent } from "./classifyIntent";
import { AutomationPlan, ExecutionContext, PlanStep } from "./types";

function steps(...actionNames: string[]): PlanStep[] {
  return actionNames.map((actionName, index) => ({ index, actionName }));
}

/**
 * Monta o plano completo de forma síncrona a partir do contexto.
 */
export function planAutomation(ctx: ExecutionContext): AutomationPlan {
  const { intent, reason } = classifyIntent(ctx);

  let planSteps: PlanStep[];

  switch (intent) {
    case "flow":
      planSteps = steps(
        "ClassifyIntent",
        "LogExecution",
        "FlowAction",
        "FinishExecution"
      );
      break;
    case "chatbot":
      planSteps = steps(
        "ClassifyIntent",
        "LogExecution",
        "ChatbotAction",
        "FinishExecution"
      );
      break;
    case "integration":
      planSteps = steps("ClassifyIntent", "LogExecution", "FinishExecution");
      break;
    case "human":
      planSteps = steps(
        "ClassifyIntent",
        "LogExecution",
        "HumanHandoffAction",
        "FinishExecution"
      );
      break;
    case "live_agent":
    case "knowledge":
      planSteps = steps(
        "ClassifyIntent",
        "LogExecution",
        "KnowledgeRetrievalAction",
        "GenerateAIResponseAction",
        "FinishExecution"
      );
      break;
    case "unknown":
    default:
      planSteps = steps(
        "ClassifyIntent",
        "LogExecution",
        "WaitForMessageAction"
      );
      break;
  }

  return {
    version: AUTOMATION_PLANNER_VERSION,
    intent,
    reason,
    steps: planSteps
  };
}

export default planAutomation;
