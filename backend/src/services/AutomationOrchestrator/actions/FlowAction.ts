import { AutomationAction } from "../ActionRegistry";
import { ActionResult, ExecutionContext } from "../types";

/**
 * Side effects = true (mutaria flow). Em observe/shadow apenas avalia —
 * nunca chama FlowBuilder nem WhatsApp.
 */
const FlowAction: AutomationAction = {
  name: "FlowAction",
  sideEffects: true,
  supportsShadow: false,
  supportsObserve: true,
  supportsActive: true,
  capability: "flows",

  supports(_ctx: ExecutionContext): boolean {
    return true;
  },

  validate(_ctx: ExecutionContext): void {},

  async execute(ctx: ExecutionContext): Promise<ActionResult> {
    if (ctx.flowState.active) {
      return {
        status: "success",
        message: ctx.flowState.reason || "flow_active_observe",
        data: {
          mode: ctx.controlMode,
          flowActive: true,
          reason: ctx.flowState.reason,
          sideEffectsBlocked: true
        },
        nextHint: "continue"
      };
    }
    return {
      status: "skip",
      message: "flow_inactive",
      data: {
        mode: ctx.controlMode,
        flowActive: false,
        sideEffectsBlocked: true
      },
      nextHint: "continue"
    };
  }
};

export default FlowAction;
