import { defineAction } from "../AutomationActionRuntime";
import { ActionResult, ExecutionContext } from "../types";

function isObserveLike(ctx: ExecutionContext): boolean {
  return (
    ctx.controlMode === "observe" ||
    ctx.controlMode === "shadow_execute" ||
    ctx.controlMode === "disabled"
  );
}

const KnowledgeRetrievalAction = defineAction(
  {
    id: "KnowledgeRetrievalAction",
    name: "KnowledgeRetrievalAction",
    version: "1.0.0",
    category: "knowledge",
    capabilities: ["knowledge"],
    description: "Recuperação de conhecimento (stub seguro, sem side effects).",
    sideEffects: false,
    tags: ["core", "knowledge"],
    owner: "atendechat.core"
  },
  {
    supports: (ctx: ExecutionContext) => ctx.aiAgent != null,
    async execute(ctx: ExecutionContext): Promise<ActionResult> {
      if (
        isObserveLike(ctx) ||
        ctx.controlMode === "active_partial" ||
        ctx.controlMode === "active"
      ) {
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
  }
);

export default KnowledgeRetrievalAction;
