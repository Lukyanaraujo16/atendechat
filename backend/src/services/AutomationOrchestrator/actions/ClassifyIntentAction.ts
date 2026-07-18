import { AutomationAction } from "../ActionRegistry";
import { classifyIntent } from "../classifyIntent";
import { ActionResult, ExecutionContext } from "../types";

const ClassifyIntentAction: AutomationAction = {
  name: "ClassifyIntent",
  sideEffects: false,
  supportsShadow: true,
  supportsObserve: true,
  supportsActive: true,
  capability: "classification",

  supports(_ctx: ExecutionContext): boolean {
    return true;
  },

  validate(_ctx: ExecutionContext): void {},

  async execute(ctx: ExecutionContext): Promise<ActionResult> {
    const result = classifyIntent(ctx);
    return {
      status: "success",
      message: result.reason,
      data: { intent: result.intent, reason: result.reason },
      nextHint: "continue"
    };
  }
};

export default ClassifyIntentAction;
