import { AutomationAction } from "../ActionRegistry";
import { ActionResult, ExecutionContext } from "../types";

const GenerateAIResponseAction: AutomationAction = {
  name: "GenerateAIResponseAction",
  sideEffects: false,
  supportsShadow: true,
  supportsObserve: true,
  supportsActive: true,
  capability: "ai_generation",

  supports(ctx: ExecutionContext): boolean {
    return ctx.aiAgent != null;
  },

  validate(_ctx: ExecutionContext): void {},

  async execute(ctx: ExecutionContext): Promise<ActionResult> {
    const intent = String(
      ctx.metadata.classifiedIntent ?? ctx.metadata.intent ?? ""
    );
    const isAiIntent =
      intent === "live_agent" ||
      intent === "knowledge" ||
      ctx.aiAgent != null;

    // Nunca envia WhatsApp — geração real fica deferred.
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
          ctx.controlMode === "observe" || ctx.controlMode === "shadow_execute"
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
};

export default GenerateAIResponseAction;
