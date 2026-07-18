import { AutomationAction } from "../ActionRegistry";
import { ActionResult, ExecutionContext } from "../types";

function isObserveLike(ctx: ExecutionContext): boolean {
  return (
    ctx.controlMode === "observe" ||
    ctx.controlMode === "shadow_execute" ||
    ctx.controlMode === "disabled"
  );
}

const KnowledgeRetrievalAction: AutomationAction = {
  name: "KnowledgeRetrievalAction",
  sideEffects: false,
  supportsShadow: true,
  supportsObserve: true,
  supportsActive: true,
  capability: "knowledge",

  supports(ctx: ExecutionContext): boolean {
    return ctx.aiAgent != null;
  },

  validate(_ctx: ExecutionContext): void {},

  async execute(ctx: ExecutionContext): Promise<ActionResult> {
    // observe/shadow: sem side effects; active ainda não chama retrieval real.
    if (isObserveLike(ctx) || ctx.controlMode === "active_partial" || ctx.controlMode === "active") {
      if (ctx.aiAgent == null) {
        return {
          status: "skip",
          message: "no_ai_agent",
          data: { mode: ctx.controlMode, wouldRetrieve: false },
          nextHint: "continue"
        };
      }
      return {
        status: "success",
        message:
          ctx.controlMode === "observe" || ctx.controlMode === "shadow_execute"
            ? "observe_would_retrieve"
            : "retrieval_deferred_safe",
        data: { mode: ctx.controlMode, wouldRetrieve: true },
        nextHint: "continue"
      };
    }

    return {
      status: "success",
      message: "observe_only_retrieval_deferred",
      data: { mode: ctx.controlMode, wouldRetrieve: true },
      nextHint: "continue"
    };
  }
};

export default KnowledgeRetrievalAction;
