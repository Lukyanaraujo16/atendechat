import {
  AnyMessageContent,
  proto,
  WAMessage,
  WASocket
} from "@whiskeysockets/baileys";
import type { WAMessageKey } from "@whiskeysockets/baileys/lib/Types/Message.js";
import { logger } from "../../../../../utils/logger";
import {
  WhatsAppDeleteTarget,
  WhatsAppOutbound,
  WhatsAppOutboundSendResult,
  WhatsAppPresence,
  WhatsAppQuotedMessage,
  WhatsAppReadKey
} from "../../../outbound/WhatsAppOutbound";

type Session = WASocket & { id?: number; user?: { id?: string } };

function toSendResult(sent: WAMessage | undefined): WhatsAppOutboundSendResult {
  return {
    messageId: sent?.key?.id != null ? String(sent.key.id) : null,
    remoteJid: sent?.key?.remoteJid != null ? String(sent.key.remoteJid) : null,
    fromMe: Boolean(sent?.key?.fromMe),
    status: sent?.status != null ? Number(sent.status) : null,
    rawSentMessage: sent
  };
}

function buildQuotedOptions(
  quoted: WhatsAppQuotedMessage
): { quoted: proto.IWebMessageInfo } | Record<string, never> {
  try {
    const msgFound =
      typeof quoted.dataJson === "string"
        ? JSON.parse(quoted.dataJson)
        : quoted.dataJson;
    if (!msgFound) return {};
    const quotedKey = msgFound.key || {};
    return {
      quoted: {
        key: {
          ...quotedKey,
          remoteJid: quoted.destinationJid,
          participant: quoted.isGroup ? quotedKey.participant : undefined
        },
        message: msgFound.message || { extendedTextMessage: {} }
      }
    };
  } catch {
    return {};
  }
}

function forcePrivacyOnlyReadReceipt(): boolean {
  return process.env.WHATSAPP_READ_RECEIPT_RESPECT_PRIVACY === "true";
}

function wantsPeerVisibleReadReceipt(): boolean {
  if (forcePrivacyOnlyReadReceipt()) {
    return false;
  }
  return process.env.WHATSAPP_READ_RECEIPT_PEER_VISIBLE === "true";
}

/**
 * Implementação outbound Baileys. Única camada que deve chamar
 * wbot.sendMessage / readMessages / sendReceipts / sendPresenceUpdate
 * nos fluxos de domínio migrados na Fase 2.
 */
export class BaileysWhatsAppOutbound implements WhatsAppOutbound {
  readonly provider = "baileys" as const;

  private readonly wbot: Session;

  constructor(wbot: Session) {
    this.wbot = wbot;
  }

  getOwnUserJid(): string | null {
    const id = this.wbot.user?.id;
    return id ? String(id) : null;
  }

  async sendText(input: {
    jid: string;
    text: string;
    quoted?: WhatsAppQuotedMessage | null;
  }): Promise<WhatsAppOutboundSendResult> {
    const chatJid = input.jid;
    const content = { text: input.text } as AnyMessageContent;
    const quotedOpts = input.quoted ? buildQuotedOptions(input.quoted) : {};
    const sent =
      Object.keys(quotedOpts).length > 0
        ? await this.wbot.sendMessage(chatJid, content, quotedOpts as never)
        : await this.wbot.sendMessage(chatJid, content);
    return toSendResult(sent);
  }

  async sendContent(input: {
    jid: string;
    content: Record<string, unknown>;
  }): Promise<WhatsAppOutboundSendResult> {
    const chatJid = input.jid;
    const sent = await this.wbot.sendMessage(
      chatJid,
      input.content as AnyMessageContent
    );
    return toSendResult(sent);
  }

  async deleteMessage(input: {
    jid: string;
    target: WhatsAppDeleteTarget;
  }): Promise<void> {
    await this.wbot.sendMessage(input.jid, {
      delete: {
        id: input.target.id,
        remoteJid: input.target.remoteJid,
        participant: input.target.participant,
        fromMe: input.target.fromMe
      }
    });
  }

  async markAsRead(keys: WhatsAppReadKey[]): Promise<void> {
    if (!keys.length) return;
    const waKeys: WAMessageKey[] = keys.map(k => {
      const waKey: WAMessageKey = {
        remoteJid: k.remoteJid,
        id: k.id,
        fromMe: k.fromMe
      };
      if (k.participant) {
        waKey.participant = k.participant;
      }
      return waKey;
    });

    const peerVisible = wantsPeerVisibleReadReceipt();
    if (peerVisible && typeof this.wbot.sendReceipts === "function") {
      await this.wbot.sendReceipts(waKeys, "read");
      return;
    }
    if (typeof this.wbot.readMessages === "function") {
      await this.wbot.readMessages(waKeys);
      return;
    }
    if (typeof this.wbot.sendReceipts === "function") {
      logger.warn(
        "[ReadReceipt] readMessages missing; fallback sendReceipts(read)"
      );
      await this.wbot.sendReceipts(waKeys, "read");
    }
  }

  async sendPresence(input: {
    jid?: string;
    presence: WhatsAppPresence;
    subscribe?: boolean;
  }): Promise<boolean> {
    const { jid } = input;
    if (
      input.subscribe &&
      jid &&
      typeof this.wbot.presenceSubscribe === "function"
    ) {
      await this.wbot.presenceSubscribe(jid);
    }
    if (typeof this.wbot.sendPresenceUpdate !== "function") {
      return false;
    }
    await this.wbot.sendPresenceUpdate(input.presence, jid);
    return true;
  }
}
