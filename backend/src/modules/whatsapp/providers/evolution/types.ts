/**
 * Fundação Evolution API (Fase 5).
 *
 * Ainda NÃO implementa:
 * - webhook inbound real
 * - mapper completo → NormalizedWhatsAppMessage
 * - envio real
 * - QR / connect / logout / ACK reais
 *
 * Inbound futuro (Fase 6+):
 * Evolution webhook → Evolution adapter → NormalizedWhatsAppMessage
 * → processInboundWhatsAppMessage
 */

export type EvolutionInstanceConfig = {
  baseUrl: string;
  instanceName: string;
  instanceId?: string | null;
};

export type EvolutionClientCapabilities = {
  sendText: boolean;
  sendMedia: boolean;
  connect: false;
  logout: false;
  qr: false;
  webhookInbound: boolean;
  ack: false;
};

/** Capacidades Evolution após Fase 8 (outbound texto/mídia HTTP). */
export const EVOLUTION_PHASE5_CAPABILITIES: EvolutionClientCapabilities = {
  sendText: true,
  sendMedia: true,
  connect: false,
  logout: false,
  qr: false,
  webhookInbound: true,
  ack: false
};

/**
 * Interface do client HTTP Evolution (skeleton).
 * Implementação real entra em fases posteriores.
 */
export interface EvolutionApiClient {
  readonly baseUrl: string;
  readonly instanceName: string;
}

export class EvolutionProviderNotReadyError extends Error {
  readonly code = "ERR_WHATSAPP_PROVIDER_NOT_READY";

  constructor(message = "Evolution WhatsApp provider ainda não está pronto") {
    super(message);
    this.name = "EvolutionProviderNotReadyError";
  }
}

export { EvolutionProviderNotReadyError as EvolutionNotReadyError };
