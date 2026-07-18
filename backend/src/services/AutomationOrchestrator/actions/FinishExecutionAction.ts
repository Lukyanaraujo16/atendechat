import { AutomationAction } from "../ActionRegistry";
import { ActionResult, ExecutionContext } from "../types";

const FinishExecutionAction: AutomationAction = {
  name: "FinishExecution",
  sideEffects: false,
  supportsShadow: true,
  supportsObserve: true,
  supportsActive: true,
  capability: "planner",

  supports(_ctx: ExecutionContext): boolean {
    return true;
  },

  validate(_ctx: ExecutionContext): void {},

  async execute(ctx: ExecutionContext): Promise<ActionResult> {
    return {
      status: "success",
      message: "execution_finished",
      data: { mode: ctx.controlMode },
      nextHint: "finish"
    };
  }
};

export default FinishExecutionAction;
