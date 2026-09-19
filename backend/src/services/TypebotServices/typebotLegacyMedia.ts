import type { WhatsAppOutbound } from "../../modules/whatsapp/outbound/WhatsAppOutbound";

/**
 * Capability temporária (12.3-C) para mídia Typebot por URL.
 * Somente o caller Baileys deve fornecer. Evolution omite — o core
 * defere image/audio sem sendContent({ url }).
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
