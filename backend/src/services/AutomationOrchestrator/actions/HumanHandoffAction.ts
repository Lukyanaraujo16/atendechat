import { AutomationAction } from "../ActionRegistry";
import { ActionResult, ExecutionContext } from "../types";

/**
 * Side effects = true (mutaria handoff/ticket). Em observe/shadow apenas sinaliza —
 * nunca chama WhatsApp nem UpdateTicket legado.
 */
const HumanHandoffAction: AutomationAction = {
  name: "HumanHandoffAction",
  sideEffects: true,
  supportsShadow: false,
  supportsObserve: true,
  supportsActive: true,
  capability: "handoff",

  supports(_ctx: ExecutionContext): boolean {
    return true;
  },

  validate(_ctx: ExecutionContext): void {},

  async execute(ctx: ExecutionContext): Promise<ActionResult> {
    const alreadyHuman =
      ctx.ticket.userId != null ||
      ctx.ticket.aiAgentHandoffRequested === true;

    return {
      status: alreadyHuman ? "handoff" : "success",
      message: alreadyHuman ? "already_with_human" : "handoff_signal_observe",
      data: {
        mode: ctx.controlMode,
        userId: ctx.ticket.userId,
        handoffRequested: ctx.ticket.aiAgentHandoffRequested === true,
        sideEffectsBlocked: true
      },
      nextHint: "handoff"
    };
  }
};

export default HumanHandoffAction;
