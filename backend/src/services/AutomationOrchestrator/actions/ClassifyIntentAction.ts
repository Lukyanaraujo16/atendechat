import { defineAction } from "../AutomationActionRuntime";
import { classifyIntent } from "../classifyIntent";
import { ActionResult, ExecutionContext } from "../types";

const ClassifyIntentAction = defineAction(
  {
    id: "ClassifyIntent",
    name: "ClassifyIntent",
    version: "1.0.0",
    category: "planner",
    capabilities: ["classification"],
    description: "Classifica a intenção do inbound sem side effects.",
    sideEffects: false,
    supportsShadow: true,
    supportsObserve: true,
    supportsActive: true,
    tags: ["core", "classification"],
    owner: "atendechat.core"
  },
  {
    supports: () => true,
    validate: () => undefined,
    async execute(ctx: ExecutionContext): Promise<ActionResult> {
      const result = classifyIntent(ctx);
      return {
        status: "success",
        message: result.reason,
        data: { intent: result.intent, reason: result.reason },
        nextHint: "continue"
      };
    }
  }
);

export default ClassifyIntentAction;
