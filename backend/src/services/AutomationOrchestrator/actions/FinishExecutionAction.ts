import { defineAction } from "../AutomationActionRuntime";
import { ActionResult, ExecutionContext } from "../types";

const FinishExecutionAction = defineAction(
  {
    id: "FinishExecution",
    name: "FinishExecution",
    version: "1.0.0",
    category: "planner",
    capabilities: ["planner"],
    description: "Finaliza o plano de automação.",
    sideEffects: false,
    tags: ["core", "finish"],
    owner: "atendechat.core"
  },
  {
    supports: () => true,
    async execute(ctx: ExecutionContext): Promise<ActionResult> {
      return {
        status: "success",
        message: "execution_finished",
        data: { mode: ctx.controlMode },
        nextHint: "finish"
      };
    }
  }
);

export default FinishExecutionAction;
