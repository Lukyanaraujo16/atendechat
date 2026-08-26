import EvolutionWebhookEvent from "../../../../../models/EvolutionWebhookEvent";
import { logger } from "../../../../../utils/logger";
import { applyNormalizedMessageStatus } from "../../../inbound/applyNormalizedMessageStatus";
import { adaptEvolutionMessageStatus } from "./adaptEvolutionMessageStatus";
import { EvolutionWebhookEnvelope } from "./evolutionWebhookTypes";

export type ReapplyDeferredEvolutionAcksResult = {
  scanned: number;
  applied: number;
  noop: number;
  skipped: number;
  stillDeferred: number;
  errors: number;
  finalAck: number | null;
};

/**
 * Reaplica ACKs `deferred` após a Message Evolution existir.
 * Usa rawPayload sanitizado (sem migration). Monotonia via shouldApplyAck.
 * Idempotente: claim processingStatus deferred → reapplying.
 */
export async function reapplyDeferredEvolutionAcks(input: {
  companyId: number;
  whatsappId: number;
  providerMessageId: string;
}): Promise<ReapplyDeferredEvolutionAcksResult> {
  const providerMessageId = String(input.providerMessageId || "").trim();
  const result: ReapplyDeferredEvolutionAcksResult = {
    scanned: 0,
    applied: 0,
    noop: 0,
    skipped: 0,
    stillDeferred: 0,
    errors: 0,
    finalAck: null
  };

  if (!input.companyId || !input.whatsappId || !providerMessageId) {
    return result;
  }

  const events = await EvolutionWebhookEvent.findAll({
    where: {
      companyId: input.companyId,
      whatsappId: input.whatsappId,
      providerMessageId,
      processingStatus: "deferred"
    },
    order: [
      ["receivedAt", "ASC"],
      ["id", "ASC"]
    ]
  });

  result.scanned = events.length;
  if (events.length === 0) {
    return result;
  }

  /* Serial por monotonia / claim — await no loop é intencional. */
  /* eslint-disable no-await-in-loop, no-continue, no-restricted-syntax */
  for (const event of events) {
    try {
      const claimed = await EvolutionWebhookEvent.update(
        { processingStatus: "reapplying" },
        {
          where: {
            id: event.id,
            processingStatus: "deferred"
          }
        }
      );
      if (!claimed[0]) {
        continue;
      }

      const adapted = adaptEvolutionMessageStatus({
        envelope: (event.rawPayload || {}) as EvolutionWebhookEnvelope,
        companyId: input.companyId,
        whatsappId: input.whatsappId
      });

      if (adapted.ok === false) {
        await event.update({
          processed: true,
          processingStatus: "skipped",
          skipReason: adapted.reason,
          errorSummary: adapted.detail?.slice(0, 500) || null
        });
        result.skipped += 1;
        continue;
      }

      const applied = await applyNormalizedMessageStatus(adapted.status);

      if (applied.outcome === "updated") {
        await event.update({
          processed: true,
          processingStatus: "processed",
          skipReason: null
        });
        result.applied += 1;
        result.finalAck = applied.ack;
      } else if (applied.outcome === "noop_same_or_lower") {
        await event.update({
          processed: true,
          processingStatus: "duplicate",
          skipReason: "ack_monotonic_noop"
        });
        result.noop += 1;
        result.finalAck = applied.ack;
      } else if (applied.outcome === "deferred") {
        await event.update({
          processed: true,
          processingStatus: "deferred",
          skipReason: "message_not_found"
        });
        result.stillDeferred += 1;
      } else {
        await event.update({
          processed: true,
          processingStatus: "skipped",
          skipReason: applied.reason
        });
        result.skipped += 1;
      }
    } catch (err) {
      result.errors += 1;
      const summary =
        err instanceof Error ? err.message.slice(0, 500) : "reapply_error";
      try {
        await event.update({
          processed: true,
          processingStatus: "error",
          errorSummary: summary
        });
      } catch {
        // ignore secondary persist failure
      }
      logger.warn(
        {
          err,
          companyId: input.companyId,
          whatsappId: input.whatsappId,
          providerMessageId,
          webhookEventId: event.id
        },
        "[EvolutionAck] reapply failed"
      );
    }
  }

  return result;
}

/**
 * Gatilho pós-persistência Evolution (inbound/outbound).
 * Falha de reapply NÃO deve derrubar o create da Message.
 */
export function scheduleReapplyDeferredEvolutionAcks(input: {
  companyId: number;
  whatsappId: number;
  providerMessageId: string;
}): void {
  // eslint-disable-next-line no-void
  void reapplyDeferredEvolutionAcks(input).catch(err => {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        whatsappId: input.whatsappId,
        providerMessageId: input.providerMessageId
      },
      "[EvolutionAck] schedule reapply failed"
    );
  });
}

/** Query utilitária para testes / diagnóstico. */
export async function countDeferredEvolutionAcks(input: {
  companyId: number;
  whatsappId: number;
  providerMessageId: string;
}): Promise<number> {
  return EvolutionWebhookEvent.count({
    where: {
      companyId: input.companyId,
      whatsappId: input.whatsappId,
      providerMessageId: input.providerMessageId,
      processingStatus: "deferred"
    }
  });
}
