import { defineAction } from "../AutomationActionRuntime";
import { ActionResult, ExecutionContext } from "../types";

const GenerateAIResponseAction = defineAction(
  {
    id: "GenerateAIResponseAction",
    name: "GenerateAIResponseAction",
    version: "1.0.0",
    category: "knowledge",
    capabilities: ["ai_generation"],
    description: "Geração de resposta IA (deferred; nunca envia WhatsApp).",
    sideEffects: false,
    tags: ["core", "ai"],
    owner: "atendechat.core"
  },
  {
    supports: (ctx: ExecutionContext) => ctx.aiAgent != null,
    async execute(ctx: ExecutionContext): Promise<ActionResult> {
      const intent = String(
        ctx.metadata.classifiedIntent ?? ctx.metadata.intent ?? ""
      );
      const isAiIntent =
        intent === "live_agent" ||
        intent === "knowledge" ||
        ctx.aiAgent != null;

      if (
        ctx.controlMode === "observe" ||
        ctx.controlMode === "shadow_execute" ||
        ctx.controlMode === "active_partial" ||
        ctx.controlMode === "active"
      ) {
        if (!isAiIntent) {
          return {
            status: "skip",
            message: "not_ai_intent",
            data: { mode: ctx.controlMode, wouldGenerate: false },
            nextHint: "continue"
          };
        }
        return {
          status: "success",
          message:
            ctx.controlMode === "observe" ||
            ctx.controlMode === "shadow_execute"
              ? "observe_would_generate"
              : "generation_deferred_safe",
          data: { mode: ctx.controlMode, wouldGenerate: true },
          nextHint: "continue"
        };
      }

      return {
        status: "success",
        message: "active_generation_deferred",
        data: { mode: ctx.controlMode, wouldGenerate: isAiIntent },
        nextHint: "continue"
      };
    }
  }
);

export default GenerateAIResponseAction;
