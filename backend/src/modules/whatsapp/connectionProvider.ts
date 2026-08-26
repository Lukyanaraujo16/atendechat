/**
 * Provider de transporte WhatsApp por conexão.
 *
 * Distinto de Whatsapp.provider (legado Baileys stable/beta).
 */

export const WhatsAppConnectionProvider = {
  BAILEYS: "baileys",
  EVOLUTION: "evolution"
} as const;

export type WhatsAppConnectionProviderValue =
  (typeof WhatsAppConnectionProvider)[keyof typeof WhatsAppConnectionProvider];

export const WHATSAPP_CONNECTION_PROVIDERS: readonly WhatsAppConnectionProviderValue[] =
  [WhatsAppConnectionProvider.BAILEYS, WhatsAppConnectionProvider.EVOLUTION];

export function isWhatsAppConnectionProvider(
  value: unknown
): value is WhatsAppConnectionProviderValue {
  return (
    typeof value === "string" &&
    (WHATSAPP_CONNECTION_PROVIDERS as readonly string[]).includes(value)
  );
}

/**
 * Normaliza o provider de transporte. Null/undefined/vazio → baileys
 * (compatibilidade pós-migration e registros legados).
 */
export function resolveWhatsAppConnectionProvider(
  whatsappOrProvider:
    | { connectionProvider?: string | null }
    | string
    | null
    | undefined
): WhatsAppConnectionProviderValue {
  const raw =
    typeof whatsappOrProvider === "string" || whatsappOrProvider == null
      ? whatsappOrProvider
      : whatsappOrProvider.connectionProvider;

  if (raw == null || String(raw).trim() === "") {
    return WhatsAppConnectionProvider.BAILEYS;
  }

  const normalized = String(raw).trim().toLowerCase();
  if (normalized === WhatsAppConnectionProvider.EVOLUTION) {
    return WhatsAppConnectionProvider.EVOLUTION;
  }
  if (normalized === WhatsAppConnectionProvider.BAILEYS) {
    return WhatsAppConnectionProvider.BAILEYS;
  }

  throw new Error(`ERR_WHATSAPP_CONNECTION_PROVIDER_INVALID: ${String(raw)}`);
}

export function parseWhatsAppConnectionProviderInput(
  value: unknown
): WhatsAppConnectionProviderValue {
  if (value == null || value === "") {
    return WhatsAppConnectionProvider.BAILEYS;
  }
  return resolveWhatsAppConnectionProvider(String(value));
}

export function isBaileysConnection(
  whatsappOrProvider:
    | { connectionProvider?: string | null }
    | string
    | null
    | undefined
): boolean {
  return (
    resolveWhatsAppConnectionProvider(whatsappOrProvider) ===
    WhatsAppConnectionProvider.BAILEYS
  );
}

export function isEvolutionConnection(
  whatsappOrProvider:
    | { connectionProvider?: string | null }
    | string
    | null
    | undefined
): boolean {
  return (
    resolveWhatsAppConnectionProvider(whatsappOrProvider) ===
    WhatsAppConnectionProvider.EVOLUTION
  );
}
