import Message from "../../../models/Message";

/**
 * Lookup de mensagem quoted pelo stanzaId normalizado.
 * Não interpreta proto Baileys.
 */
export async function resolveQuotedMessageByStanzaId(
  quotedStanzaId: string | null | undefined
): Promise<Message | null> {
  if (!quotedStanzaId || String(quotedStanzaId).trim() === "") {
    return null;
  }
  const quotedMsg = await Message.findOne({
    where: { id: String(quotedStanzaId) }
  });
  return quotedMsg || null;
}
