import type { WhatsAppOutbound } from "../../modules/whatsapp/outbound/WhatsAppOutbound";

/**
 * @deprecated 12.3-F — Typebot envia Buffer via sendTypebotRemoteMedia.
 * Payload `{ image: { url } }` / `{ audio: { url } }` NÃO deve ir ao Evolution.
 * Mantido isolado caso um adapter Baileys legado precise do contrato URL.
 */
export type TypebotLegacyMediaKind = "image" | "audio";

export type TypebotLegacyMediaCapability = {
  sendUrlMedia: (input: {
    jid: string;
    kind: TypebotLegacyMediaKind;
    url: string;
  }) => Promise<void>;
};

export function createTypebotLegacyUrlMediaSender(
  outbound: WhatsAppOutbound
): TypebotLegacyMediaCapability {
  return {
    async sendUrlMedia({ jid, kind, url }) {
      if (kind === "audio") {
        await outbound.sendContent({
          jid,
          content: {
            audio: {
              url,
              mimetype: "audio/mp4",
              ptt: true
            }
          }
        });
        return;
      }
      await outbound.sendContent({
        jid,
        content: {
          image: { url }
        }
      });
    }
  };
}
