/**
 * Fundação Evolution API (Fase 5+).
 * Fase 9A: ACK webhook, markAsRead e presence HTTP ativos.
 * Ainda NÃO: quoted/delete (9B), QR / connect / logout.
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
  ack: boolean;
  markAsRead: boolean;
  presence: boolean;
};

/** Capacidades Evolution após Fase 9A (ACK / markAsRead / presence). */
export const EVOLUTION_PHASE5_CAPABILITIES: EvolutionClientCapabilities = {
  sendText: true,
  sendMedia: true,
  connect: false,
  logout: false,
  qr: false,
  webhookInbound: true,
  ack: true,
  markAsRead: true,
  presence: true
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
