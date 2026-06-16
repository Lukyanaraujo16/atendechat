import InstagramAccount from "../../models/InstagramAccount";
import MetaWebhookEvent from "../../models/MetaWebhookEvent";
import { hashPayloadForEventId } from "../../helpers/metaWebhookSignature";
import { logger } from "../../utils/logger";
import {
  buildSafeWebhookLogSummary,
  parseInstagramWebhookPayload,
  ParsedInstagramWebhookEvent
} from "./InstagramWebhookParser";

interface ProcessRequest {
  payload: Record<string, unknown>;
  signatureValid: boolean;
}

interface MappedAccount {
  id: number;
  companyId: number;
}

const findMappedInstagramAccount = async (
  businessAccountId: string | null
): Promise<MappedAccount | null> => {
  if (!businessAccountId) {
    return null;
  }

  const account = await InstagramAccount.findOne({
    where: {
      instagramBusinessAccountId: businessAccountId,
      status: "CONNECTED"
    },
    attributes: ["id", "companyId"]
  });

  if (!account) {
    return null;
  }

  return { id: account.id, companyId: account.companyId };
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
): Promise<"stored" | "duplicate"> => {
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
    return "duplicate";
  }

  await MetaWebhookEvent.create({
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

  return "stored";
};

const processParsedEvent = async (
  parsed: ParsedInstagramWebhookEvent,
  payload: Record<string, unknown>,
  signatureValid: boolean
): Promise<void> => {
  const mapped = await findMappedInstagramAccount(
    parsed.instagramBusinessAccountId
  );

  const accountMapped = Boolean(mapped);

  if (!accountMapped && parsed.instagramBusinessAccountId) {
    logger.warn(
      {
        instagramBusinessAccountId: parsed.instagramBusinessAccountId,
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

  try {
    await persistWebhookEvent(parsed, payload, signatureValid, mapped);
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
      return;
    }

    throw err;
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
