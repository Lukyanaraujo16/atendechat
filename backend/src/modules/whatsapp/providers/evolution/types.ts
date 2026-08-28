/**
 * Fundação Evolution API (Fase 5+).
 * Fase 10: lifecycle — create/connect/QR/state/logout/restart/CONNECTION_UPDATE.
 */

export type EvolutionInstanceConfig = {
  baseUrl: string;
  instanceName: string;
  instanceId?: string | null;
};

export type EvolutionClientCapabilities = {
  sendText: boolean;
  sendMedia: boolean;
  connect: boolean;
  logout: boolean;
  qr: boolean;
  webhookInbound: boolean;
  ack: boolean;
  markAsRead: boolean;
  presence: boolean;
};

/** Capacidades Evolution após Fase 10 (lifecycle). */
export const EVOLUTION_PHASE5_CAPABILITIES: EvolutionClientCapabilities = {
  sendText: true,
  sendMedia: true,
  connect: true,
  logout: true,
  qr: true,
  webhookInbound: true,
  ack: true,
  markAsRead: true,
  presence: true
};

/**
 * Interface do client HTTP Evolution (skeleton).
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
