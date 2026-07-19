import { logger } from "../../../utils/logger";
import { defineAction } from "../AutomationActionRuntime";
import { ActionResult, ExecutionContext } from "../types";

const LogExecutionAction = defineAction(
  {
    id: "LogExecution",
    name: "LogExecution",
    version: "1.0.0",
    category: "system",
    capabilities: ["planner"],
    description: "Registra log estruturado da execução (sem side effects).",
    sideEffects: false,
    tags: ["core", "logging"],
    owner: "atendechat.core"
  },
  {
    supports: () => true,
    async execute(ctx: ExecutionContext): Promise<ActionResult> {
      logger.info(
        {
          companyId: ctx.companyId,
          ticketId: ctx.ticketId,
          channel: ctx.channel,
          messageId: ctx.messageId,
          controlMode: ctx.controlMode,
          intent: ctx.metadata.classifiedIntent ?? ctx.metadata.intent
        },
        "[AutomationOrchestrator] LogExecution"
      );

      return {
        status: "success",
        message: "logged",
        data: {
          companyId: ctx.companyId,
          ticketId: ctx.ticketId,
          controlMode: ctx.controlMode
        },
        nextHint: "continue"
      };
    }
  }
);

export default LogExecutionAction;
