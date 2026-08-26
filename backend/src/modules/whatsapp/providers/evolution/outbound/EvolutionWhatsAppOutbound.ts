import {
  WhatsAppOutbound,
  WhatsAppOutboundSendResult,
  WhatsAppPresence,
  WhatsAppQuotedMessage,
  WhatsAppReadKey,
  WhatsAppDeleteTarget
} from "../../../outbound/WhatsAppOutbound";
import { throwEvolutionProviderNotReady } from "../evolutionErrors";

/**
 * Skeleton outbound Evolution (Fase 5).
 * Nenhum método realiza transporte real — todos falham de forma controlada.
 */
/* eslint-disable class-methods-use-this */
export class EvolutionWhatsAppOutbound implements WhatsAppOutbound {
  readonly provider = "evolution" as const;

  getOwnUserJid(): string | null {
    return null;
  }

  async sendText(_input: {
    jid: string;
    text: string;
    quoted?: WhatsAppQuotedMessage | null;
  }): Promise<WhatsAppOutboundSendResult> {
    throwEvolutionProviderNotReady("Evolution sendText não implementado");
  }

  async sendContent(_input: {
    jid: string;
    content: Record<string, unknown>;
  }): Promise<WhatsAppOutboundSendResult> {
    throwEvolutionProviderNotReady("Evolution sendContent não implementado");
  }

  async deleteMessage(_input: {
    jid: string;
    target: WhatsAppDeleteTarget;
  }): Promise<void> {
    throwEvolutionProviderNotReady("Evolution deleteMessage não implementado");
  }

  async markAsRead(_keys: WhatsAppReadKey[]): Promise<void> {
    throwEvolutionProviderNotReady("Evolution markAsRead não implementado");
  }

  async sendPresence(_input: {
    jid?: string;
    presence: WhatsAppPresence;
    subscribe?: boolean;
  }): Promise<boolean> {
    throwEvolutionProviderNotReady("Evolution sendPresence não implementado");
  }
}
