import { defineAction } from "../AutomationActionRuntime";
import { ActionResult, ExecutionContext } from "../types";

const WaitForMessageAction = defineAction(
  {
    id: "WaitForMessageAction",
    name: "WaitForMessageAction",
    version: "1.0.0",
    category: "system",
    capabilities: ["wait"],
    description: "Aguarda próxima mensagem do contato.",
    sideEffects: false,
    tags: ["core", "wait"],
    owner: "atendechat.core"
  },
  {
    supports: () => true,
    async execute(ctx: ExecutionContext): Promise<ActionResult> {
      return {
        status: "waiting",
        message: "waiting_for_message",
        data: { mode: ctx.controlMode },
        nextHint: "wait"
      };
    }
  }
);

export default WaitForMessageAction;
