import { getIO } from "../../../libs/socket";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import { serializeMessageForClient } from "../../../services/MessageServices/CreateMessageService";
import { logger } from "../../../utils/logger";
import { findMessageForStatusUpdate } from "./applyNormalizedMessageStatus";
import { NormalizedWhatsAppReaction } from "./NormalizedWhatsAppMessage";

export const WHATSAPP_REACTIONS_META_KEY = "whatsappReactions";

export type WhatsAppStoredReaction = {
  emoji: string;
  fromMe: boolean;
  reactorMessageId: string;
  reactorKey: string;
  updatedAt: string;
};

export type ApplyInboundWhatsAppReactionInput = {
  companyId: number;
  whatsappId: number;
  reactorMessageId: string;
  fromMe: boolean;
  remoteJid: string | null;
  participant: string | null;
  reaction: NormalizedWhatsAppReaction;
};

export type ApplyInboundWhatsAppReactionResult =
  | {
      outcome: "updated" | "noop";
      targetMessageId: string;
      ticketId: number;
    }
  | { outcome: "skipped"; reason: string };

const TARGET_INCLUDE = [
  "contact",
  {
    model: Ticket,
    as: "ticket",
    include: [
      "contact",
      "queue",
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["name", "ticketVisibility", "connectionProvider"]
      }
    ]
  },
  {
    model: Message,
    as: "quotedMsg",
    include: ["contact"]
  }
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readStoredWhatsAppReactions(
  metaPayload: Record<string, unknown> | null | undefined
): WhatsAppStoredReaction[] {
  const raw = metaPayload?.[WHATSAPP_REACTIONS_META_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is WhatsAppStoredReaction => {
    if (!item || typeof item !== "object") return false;
    const rec = item as Record<string, unknown>;
    return (
      typeof rec.emoji === "string" &&
      rec.emoji.trim().length > 0 &&
      typeof rec.reactorMessageId === "string" &&
      typeof rec.reactorKey === "string"
    );
  });
}

function reactorKey(input: ApplyInboundWhatsAppReactionInput): string {
  if (input.fromMe) return "me";
  const participant = String(input.participant || "").trim();
  if (participant) return participant;
  const remoteJid = String(input.remoteJid || "").trim();
  if (remoteJid) return remoteJid;
  return `reactor:${input.reactorMessageId}`;
}

export function mergeWhatsAppReactions(
  current: WhatsAppStoredReaction[],
  next: WhatsAppStoredReaction
): { list: WhatsAppStoredReaction[]; changed: boolean } {
  const sameReactor = current.find(item => item.reactorKey === next.reactorKey);
  if (sameReactor && sameReactor.emoji === next.emoji) {
    return { list: current, changed: false };
  }
  const withoutReactor = current.filter(
    item => item.reactorKey !== next.reactorKey
  );
  return { list: [...withoutReactor, next], changed: true };
}

/**
 * Associa reação inbound à mensagem alvo (tenant + whatsapp scoped).
 * Não cria Message de timeline. Não usa lookup global só por id.
 */
export async function applyInboundWhatsAppReaction(
  input: ApplyInboundWhatsAppReactionInput
): Promise<ApplyInboundWhatsAppReactionResult> {
  const emoji = String(input.reaction?.emoji || "").trim();
  const targetStanzaId = String(input.reaction?.targetStanzaId || "").trim();
  if (!emoji || !targetStanzaId) {
    return { outcome: "skipped", reason: "invalid_reaction" };
  }
  if (!input.companyId || !input.whatsappId) {
    return { outcome: "skipped", reason: "missing_tenant" };
  }

  const target = await findMessageForStatusUpdate({
    companyId: input.companyId,
    whatsappId: input.whatsappId,
    messageId: targetStanzaId
  });

  if (!target) {
    logger.info(
      {
        companyId: input.companyId,
        whatsappId: input.whatsappId,
        targetStanzaId,
        reactorMessageId: input.reactorMessageId
      },
      "[WhatsAppReaction] target not found"
    );
    return { outcome: "skipped", reason: "reaction_target_not_found" };
  }

  const stored: WhatsAppStoredReaction = {
    emoji,
    fromMe: Boolean(input.fromMe),
    reactorMessageId: String(input.reactorMessageId),
    reactorKey: reactorKey(input),
    updatedAt: new Date().toISOString()
  };

  const currentMeta = asRecord(target.metaPayload);
  const current = readStoredWhatsAppReactions(currentMeta);
  const merged = mergeWhatsAppReactions(current, stored);

  if (!merged.changed) {
    return {
      outcome: "noop",
      targetMessageId: target.id,
      ticketId: target.ticketId
    };
  }

  await target.update({
    metaPayload: {
      ...currentMeta,
      [WHATSAPP_REACTIONS_META_KEY]: merged.list
    }
  });

  const refreshed = await Message.findByPk(target.id, {
    include: TARGET_INCLUDE
  });

  if (refreshed) {
    const io = getIO();
    io.to(refreshed.ticketId.toString()).emit(
      `company-${refreshed.companyId}-appMessage`,
      {
        action: "update",
        message: serializeMessageForClient(refreshed)
      }
    );
  }

  return {
    outcome: "updated",
    targetMessageId: target.id,
    ticketId: target.ticketId
  };
}
