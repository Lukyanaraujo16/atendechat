import { defineAction } from "../AutomationActionRuntime";
import { ActionResult, ExecutionContext } from "../types";

const FlowAction = defineAction(
  {
    id: "FlowAction",
    name: "FlowAction",
    version: "1.0.0",
    category: "flow",
    capabilities: ["flows"],
    description: "Observa estado de fluxo legado sem mutar.",
    sideEffects: true,
    supportsShadow: false,
    supportsObserve: true,
    supportsActive: true,
    tags: ["core", "flow"],
    owner: "atendechat.core"
  },
  {
    supports: () => true,
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
  }
);

export default FlowAction;
