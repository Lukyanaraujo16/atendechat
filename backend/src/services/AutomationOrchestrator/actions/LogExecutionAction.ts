import { logger } from "../../../utils/logger";
import { AutomationAction } from "../ActionRegistry";
import { ActionResult, ExecutionContext } from "../types";

const LogExecutionAction: AutomationAction = {
  name: "LogExecution",
  sideEffects: false,
  supportsShadow: true,
  supportsObserve: true,
  supportsActive: true,
  capability: "planner",

  supports(_ctx: ExecutionContext): boolean {
    return true;
  },

  validate(_ctx: ExecutionContext): void {},

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
};

export default LogExecutionAction;
