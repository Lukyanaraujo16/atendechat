import { defineAction } from "../AutomationActionRuntime";
import { ActionResult, ExecutionContext } from "../types";

const ChatbotAction = defineAction(
  {
    id: "ChatbotAction",
    name: "ChatbotAction",
    version: "1.0.0",
    category: "chatbot",
    capabilities: ["chatbot"],
    description: "Observa estado do chatbot legado sem mutar.",
    sideEffects: true,
    supportsShadow: false,
    supportsObserve: true,
    supportsActive: true,
    tags: ["core", "chatbot"],
    owner: "atendechat.core"
  },
  {
    supports: () => true,
    async execute(ctx: ExecutionContext): Promise<ActionResult> {
      if (ctx.chatbotState.active) {
        return {
          status: "success",
          message: "chatbot_active_observe",
          data: {
            mode: ctx.controlMode,
            chatbotActive: true,
            sideEffectsBlocked: true
          },
          nextHint: "continue"
        };
      }
      return {
        status: "skip",
        message: "chatbot_inactive",
        data: {
          mode: ctx.controlMode,
          chatbotActive: false,
          sideEffectsBlocked: true
        },
        nextHint: "continue"
      };
    }
  }
);

export default ChatbotAction;
