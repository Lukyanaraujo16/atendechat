import { Op } from "sequelize";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import {
  AI_AGENT_LIVE_COOLDOWN_MS,
  AI_AGENT_LIVE_MAX_CONSECUTIVE_FAILURES,
  AI_AGENT_LIVE_MAX_REPLIES_PER_TICKET
} from "./aiAgentLiveConfig";
import {
  AI_AGENT_LIVE_DELIVERY_STATUSES,
  AI_AGENT_LIVE_ERROR_CODES,
  AI_AGENT_LIVE_STATUSES
} from "./aiAgentLiveErrors";

export type AiAgentLiveLimitsResult =
  | { allowed: true }
  | { allowed: false; errorCode: string };

export async function checkAiAgentLiveLimits(input: {
  companyId: number;
  ticketId: number;
}): Promise<AiAgentLiveLimitsResult> {
  const sentCount = await AiAgentRuntimeLog.count({
    where: {
      companyId: input.companyId,
      ticketId: input.ticketId,
      mode: "live",
      liveStatus: AI_AGENT_LIVE_STATUSES.SENT,
      deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SENT
    }
  });

  if (sentCount >= AI_AGENT_LIVE_MAX_REPLIES_PER_TICKET) {
    return {
      allowed: false,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_TICKET_LIMIT_REACHED
    };
  }

  const lastSent = await AiAgentRuntimeLog.findOne({
    where: {
      companyId: input.companyId,
      ticketId: input.ticketId,
      mode: "live",
      liveStatus: AI_AGENT_LIVE_STATUSES.SENT
    },
    order: [["sentAt", "DESC"]],
    attributes: ["sentAt"]
  });

  if (lastSent?.sentAt) {
    const elapsed = Date.now() - new Date(lastSent.sentAt).getTime();
    if (elapsed < AI_AGENT_LIVE_COOLDOWN_MS) {
      return {
        allowed: false,
        errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_COOLDOWN_ACTIVE
      };
    }
  }

  const recentFailures = await AiAgentRuntimeLog.findAll({
    where: {
      companyId: input.companyId,
      ticketId: input.ticketId,
      mode: "live",
      liveStatus: {
        [Op.in]: [AI_AGENT_LIVE_STATUSES.FAILED, AI_AGENT_LIVE_STATUSES.RATE_LIMITED]
      }
    },
    order: [["createdAt", "DESC"]],
    limit: AI_AGENT_LIVE_MAX_CONSECUTIVE_FAILURES,
    attributes: ["id", "liveStatus", "createdAt"]
  });

  if (
    recentFailures.length >= AI_AGENT_LIVE_MAX_CONSECUTIVE_FAILURES &&
    recentFailures.every(
      (row) =>
        row.liveStatus === AI_AGENT_LIVE_STATUSES.FAILED ||
        row.liveStatus === AI_AGENT_LIVE_STATUSES.RATE_LIMITED
    )
  ) {
    const hasSuccessAfter = await AiAgentRuntimeLog.count({
      where: {
        companyId: input.companyId,
        ticketId: input.ticketId,
        mode: "live",
        liveStatus: AI_AGENT_LIVE_STATUSES.SENT,
        createdAt: { [Op.gt]: recentFailures[0].createdAt }
      }
    });
    if (hasSuccessAfter === 0) {
      return {
        allowed: false,
        errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_GENERATION_FAILED
      };
    }
  }

  return { allowed: true };
}
