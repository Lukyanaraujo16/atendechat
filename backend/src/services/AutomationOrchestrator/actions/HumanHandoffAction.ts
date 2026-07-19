import { defineAction } from "../AutomationActionRuntime";
import { ActionResult, ExecutionContext } from "../types";

const HumanHandoffAction = defineAction(
  {
    id: "HumanHandoffAction",
    name: "HumanHandoffAction",
    version: "1.0.0",
    category: "human",
    capabilities: ["handoff"],
    description:
      "Sinaliza handoff humano. Side effects bloqueados até ativação real.",
    sideEffects: true,
    supportsShadow: false,
    supportsObserve: true,
    supportsActive: true,
    tags: ["core", "handoff"],
    owner: "atendechat.core"
  },
  {
    supports: () => true,
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
  }
);

export default HumanHandoffAction;
