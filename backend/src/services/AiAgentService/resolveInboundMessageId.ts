export type InboundMessageIdSource = "baileys" | "persisted" | "missing";

export type ResolvedInboundMessageId = {
  messageId: string | null;
  source: InboundMessageIdSource;
};

function isReliableMessageId(value: unknown): value is string {
  if (value == null) return false;
  const id = String(value).trim();
  if (!id) return false;
  if (id.startsWith("fallback-")) return false;
  return true;
}

/**
 * Resolve o identificador inbound para idempotência.
 * Não usa Date.now() — ausência de ID confiável retorna source=missing.
 */
export function resolveInboundMessageId(input: {
  baileysMessageId?: string | null;
  persistedMessageId?: string | null;
}): ResolvedInboundMessageId {
  if (isReliableMessageId(input.baileysMessageId)) {
    return { messageId: String(input.baileysMessageId).trim(), source: "baileys" };
  }
  if (isReliableMessageId(input.persistedMessageId)) {
    return {
      messageId: String(input.persistedMessageId).trim(),
      source: "persisted"
    };
  }
  return { messageId: null, source: "missing" };
}
