import { WhatsAppInboundProvider } from "./NormalizedWhatsAppMessage";

/**
 * Status/ACK normalizado — provider-agnostic.
 * Domínio atualiza Message.ack a partir deste DTO, não de enums textuais Evolution.
 */
export type NormalizedWhatsAppMessageStatus = {
  provider: WhatsAppInboundProvider;
  companyId: number;
  whatsappId: number;
  /** Id canônico do provider (key.id / keyId). */
  messageId: string;
  /** Ack StreamHub 0–5. */
  ack: number;
  fromMe: boolean | null;
  remoteJid: string | null;
  participant: string | null;
  timestamp: Date | null;
  /** Status cru do provider (PENDING, DELIVERY_ACK, number…). */
  providerStatus: string | number | null;
};

export type ApplyNormalizedMessageStatusResult =
  | {
      outcome: "updated";
      messageId: string;
      previousAck: number;
      ack: number;
    }
  | {
      outcome: "noop_same_or_lower";
      messageId: string;
      ack: number;
    }
  | {
      outcome: "deferred";
      reason: "message_not_found";
    }
  | {
      outcome: "skipped";
      reason: string;
    };
