import InstagramAccount from "../../models/InstagramAccount";
import MetaWebhookEvent from "../../models/MetaWebhookEvent";
import { hashPayloadForEventId } from "../../helpers/metaWebhookSignature";
import { logger } from "../../utils/logger";
import {
  buildSafeWebhookLogSummary,
  collectInstagramBusinessAccountCandidateIds,
  parseInstagramWebhookPayload,
  ParsedInstagramWebhookEvent
} from "./InstagramWebhookParser";
import ProcessInstagramDirectMessageService from "./ProcessInstagramDirectMessageService";
import ProcessInstagramReactionService from "./ProcessInstagramReactionService";
import { isInstagramIntegrationEnabledForCompany } from "../../helpers/assertInstagramIntegrationInPlan";

interface ProcessRequest {
  payload: Record<string, unknown>;
  signatureValid: boolean;
}

interface MappedAccount {
  id: number;
  companyId: number;
}

type PersistResult =
  | { status: "stored"; eventId: number; externalEventId: string }
  | { status: "duplicate"; externalEventId: string };

const findMappedInstagramAccount = async (
  parsed: ParsedInstagramWebhookEvent
): Promise<MappedAccount | null> => {
  const candidateIds = collectInstagramBusinessAccountCandidateIds(parsed);

  for (const businessAccountId of candidateIds) {
    const account = await InstagramAccount.findOne({
      where: {
        instagramBusinessAccountId: businessAccountId,
        status: "CONNECTED"
      },
      attributes: ["id", "companyId"]
    });

    if (account) {
      return { id: account.id, companyId: account.companyId };
    }
  }

  return null;
};

const resolveExternalEventId = (
  parsed: ParsedInstagramWebhookEvent,
  payload: Record<string, unknown>
): string => {
  if (parsed.messageId) {
    return parsed.messageId;
  }

  const base = parsed.rawMessagingItem || payload;
  return hashPayloadForEventId({
    object: parsed.object,
    entryId: parsed.entryId,
    eventType: parsed.eventType,
    senderId: parsed.senderId,
    recipientId: parsed.recipientId,
    timestamp: parsed.timestamp,
    payload: base
  });
};

const persistWebhookEvent = async (
  parsed: ParsedInstagramWebhookEvent,
  payload: Record<string, unknown>,
  signatureValid: boolean,
  mapped: MappedAccount | null
): Promise<PersistResult> => {
  const externalEventId = resolveExternalEventId(parsed, payload);

  const existing = await MetaWebhookEvent.findOne({
    where: { externalEventId }
  });

  if (existing) {
    logger.info(
      {
        externalEventId,
        object: parsed.object,
        eventType: parsed.eventType
      },
      "[InstagramWebhook] duplicate event skipped"
    );
    return { status: "duplicate", externalEventId };
  }

  const created = await MetaWebhookEvent.create({
    companyId: mapped?.companyId ?? null,
    instagramAccountId: mapped?.id ?? null,
    object: parsed.object,
    eventType: parsed.eventType,
    externalEventId,
    rawPayload: payload,
    signatureValid,
    processed: false,
    receivedAt: new Date()
  });

  return { status: "stored", eventId: created.id, externalEventId };
};

const processInboundIfApplicable = async (
  parsed: ParsedInstagramWebhookEvent,
  mapped: MappedAccount,
  persistResult: PersistResult
): Promise<void> => {
  if (parsed.eventType === "reaction") {
    try {
      await ProcessInstagramReactionService({
        parsed,
        instagramAccountId: mapped.id,
        companyId: mapped.companyId,
        externalEventId: persistResult.externalEventId,
        webhookEventId:
          persistResult.status === "stored" ? persistResult.eventId : null
      });
    } catch (err) {
      logger.error(
        {
          err,
          stack: err instanceof Error ? err.stack : undefined,
          instagramAccountId: mapped.id,
          companyId: mapped.companyId
        },
        "[InstagramReaction] error_processing"
      );
    }
    return;
  }

  if (parsed.eventType !== "message") {
    if (persistResult.status === "stored") {
      await MetaWebhookEvent.update(
        { processed: true },
        { where: { id: persistResult.eventId } }
      );
    }
    return;
  }

  if (persistResult.status === "duplicate") {
    await ProcessInstagramDirectMessageService({
      parsed,
      instagramAccountId: mapped.id,
      companyId: mapped.companyId,
      externalEventId: persistResult.externalEventId,
      webhookEventId: null
    });
    return;
  }

  await ProcessInstagramDirectMessageService({
    parsed,
    instagramAccountId: mapped.id,
    companyId: mapped.companyId,
    externalEventId: persistResult.externalEventId,
    webhookEventId: persistResult.eventId
  });
};

const processParsedEvent = async (
  parsed: ParsedInstagramWebhookEvent,
  payload: Record<string, unknown>,
  signatureValid: boolean
): Promise<void> => {
  const mapped = await findMappedInstagramAccount(parsed);

  const accountMapped = Boolean(mapped);
  const candidateIds = collectInstagramBusinessAccountCandidateIds(parsed);

  if (!accountMapped && candidateIds.length) {
    logger.warn(
      {
        instagramBusinessAccountId: parsed.instagramBusinessAccountId,
        entryId: parsed.entryId,
        senderId: parsed.senderId,
        recipientId: parsed.recipientId,
        candidateIds,
        object: parsed.object
      },
      "[InstagramWebhook] account_not_mapped"
    );
  }

  logger.info(
    buildSafeWebhookLogSummary(
      parsed,
      mapped?.id ?? null,
      mapped?.companyId ?? null,
      accountMapped
    ),
    "[InstagramWebhook] received"
  );

  let persistResult: PersistResult;

  try {
    persistResult = await persistWebhookEvent(
      parsed,
      payload,
      signatureValid,
      mapped
    );
  } catch (err) {
    const isUniqueViolation =
      err instanceof Error &&
      (err.name === "SequelizeUniqueConstraintError" ||
        err.message.includes("unique"));

    if (isUniqueViolation) {
      logger.info(
        { externalEventId: resolveExternalEventId(parsed, payload) },
        "[InstagramWebhook] duplicate event skipped (race)"
      );
      persistResult = {
        status: "duplicate",
        externalEventId: resolveExternalEventId(parsed, payload)
      };
    } else {
      throw err;
    }
  }

  if (!mapped) {
    return;
  }

  const integrationEnabled = await isInstagramIntegrationEnabledForCompany(
    mapped.companyId
  );
  if (!integrationEnabled) {
    logger.info(
      {
        companyId: mapped.companyId,
        instagramAccountId: mapped.id,
        eventType: parsed.eventType
      },
      "[InstagramPlan] webhook_ignored_plan_disabled"
    );
    return;
  }

  try {
    await processInboundIfApplicable(parsed, mapped, persistResult);
  } catch (err) {
    logger.error(
      {
        err,
        stack: err instanceof Error ? err.stack : undefined,
        instagramAccountId: mapped.id,
        companyId: mapped.companyId,
        messageId: parsed.messageId
      },
      "[InstagramInbound] error_processing"
    );
  }
};

const ProcessMetaInstagramWebhookService = async ({
  payload,
  signatureValid
}: ProcessRequest): Promise<void> => {
  const object =
    typeof payload.object === "string" ? payload.object : "unknown";

  if (object !== "instagram") {
    logger.info({ object }, "[InstagramWebhook] ignored non-instagram object");
    return;
  }

  const parsedEvents = parseInstagramWebhookPayload(payload);

  for (const parsed of parsedEvents) {
    await processParsedEvent(parsed, payload, signatureValid);
  }
};

export default ProcessMetaInstagramWebhookService;
