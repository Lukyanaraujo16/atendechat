import { AutomationAction } from "../ActionRegistry";
import { ActionResult, ExecutionContext } from "../types";

const WaitForMessageAction: AutomationAction = {
  name: "WaitForMessageAction",
  sideEffects: false,
  supportsShadow: true,
  supportsObserve: true,
  supportsActive: true,
  capability: "wait",

  supports(_ctx: ExecutionContext): boolean {
    return true;
  },

  validate(_ctx: ExecutionContext): void {},

  async execute(ctx: ExecutionContext): Promise<ActionResult> {
    return {
      status: "waiting",
      message: "waiting_for_message",
      data: { mode: ctx.controlMode },
      nextHint: "wait"
    };
  }
};

export default WaitForMessageAction;
