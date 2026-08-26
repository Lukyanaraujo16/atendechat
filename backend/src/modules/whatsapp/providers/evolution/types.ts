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
  sendText: false;
  sendMedia: false;
  connect: false;
  logout: false;
  qr: false;
  webhookInbound: false;
  ack: false;
};

/** Capacidades desta fase: nenhuma operação de transporte real. */
export const EVOLUTION_PHASE5_CAPABILITIES: EvolutionClientCapabilities = {
  sendText: false,
  sendMedia: false,
  connect: false,
  logout: false,
  qr: false,
  webhookInbound: false,
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
