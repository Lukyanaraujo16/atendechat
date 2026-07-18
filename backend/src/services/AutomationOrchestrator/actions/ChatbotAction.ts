import { AutomationAction } from "../ActionRegistry";
import { ActionResult, ExecutionContext } from "../types";

/**
 * Side effects = true (mutaria ticket/chatbot). Em observe/shadow/capability não-active
 * apenas avalia estado — nunca chama WhatsApp nem módulos legados.
 */
const ChatbotAction: AutomationAction = {
  name: "ChatbotAction",
  sideEffects: true,
  supportsShadow: false,
  supportsObserve: true,
  supportsActive: true,
  capability: "chatbot",

  supports(_ctx: ExecutionContext): boolean {
    return true;
  },

  validate(_ctx: ExecutionContext): void {},

  async execute(ctx: ExecutionContext): Promise<ActionResult> {
    // Sempre observe-only: não muta chatbot legado.
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
};

export default ChatbotAction;
