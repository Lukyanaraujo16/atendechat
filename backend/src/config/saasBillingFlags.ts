/**
 * Feature flags do financeiro SaaS — defaults seguros até homologação.
 * Fonte: docs/EFI-PAY-CONTRACTS-MATRIX.md
 */

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "true" || raw === "1";
}

export const saasBillingFlags = {
  /** Geração automática de faturas (cron). Default OFF até homologação. */
  autoInvoice: (): boolean => envBool("SAAS_BILLING_AUTO_INVOICE", false),

  /** Renovar dueDate após pagamento gateway confirmado. */
  autoRenewOnPayment: (): boolean =>
    envBool("SAAS_BILLING_AUTO_RENEW_ON_PAYMENT", true),

  /** Checkout Pix (fluxo existente). */
  pixEnabled: (): boolean => envBool("EFI_PIX_ENABLED", true),

  /** Emissão boleto via API Cobranças. */
  boletoEnabled: (): boolean => envBool("EFI_BOLETO_ENABLED", false),

  /** Emissão cartão via API Cobranças. */
  cardEnabled: (): boolean => envBool("EFI_CARD_ENABLED", false),

  /** Tentar PUT /v1/charge/{id}/settle na baixa manual (só Cobranças). */
  cobrancasSettleEnabled: (): boolean =>
    envBool("EFI_COBRANCAS_SETTLE_ENABLED", false),

  /** Assinaturas nativas Efí / Pix Automático. */
  nativeSubscriptionEnabled: (): boolean =>
    envBool("EFI_NATIVE_SUBSCRIPTION_ENABLED", false),

  /** Sandbox Gerencianet/Efí — default true (seguro) se env ausente. */
  gerencianetSandbox: (): boolean => {
    const raw = process.env.GERENCIANET_SANDBOX;
    if (raw === undefined || raw === "") return true;
    return raw === "true" || raw === "1";
  },

  /** Webhook secret obrigatório fora de desenvolvimento. */
  requireWebhookSecret: (): boolean => {
    const nodeEnv = process.env.NODE_ENV || "development";
    if (nodeEnv === "development" || nodeEnv === "test") {
      return envBool("WEBHOOK_SUBSCRIPTION_SECRET_REQUIRED", false);
    }
    return true;
  }
};

export default saasBillingFlags;

/**
 * Controles de ativação da Fase 8.3-B3 (DECISOES §8.2, PRD RF0).
 * Default = comportamento atual. Valor inválido cai no default e é sinalizado em `invalid`.
 * Ler aqui não ativa nada: cada etapa decide o que o controle liga.
 */
export type EfiCredentialsSource = "legacy_env" | "database";
export type EfiWebhookPipeline = "legacy" | "async";

export type EfiActivationControls = {
  credentialsSource: EfiCredentialsSource;
  pixChargeV2Enabled: boolean;
  webhookPipeline: EfiWebhookPipeline;
  webhookWorkerPaused: boolean;
  pixReconciliationSweepEnabled: boolean;
  trustProxyHops: number | null;
  /** Nomes dos controles com valor inválido (caíram no default). */
  invalid: string[];
};

function envEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  defaultValue: T,
  invalid: string[]
): T {
  const raw = (process.env[key] || "").trim().toLowerCase();
  if (raw === "") return defaultValue;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  invalid.push(key);
  return defaultValue;
}

function envStrictBool(key: string, invalid: string[]): boolean {
  const raw = (process.env[key] || "").trim().toLowerCase();
  if (raw === "") return false;
  if (raw === "true" || raw === "1") return true;
  if (raw !== "false" && raw !== "0") invalid.push(key);
  return false;
}

export function getEfiActivationControls(): EfiActivationControls {
  const invalid: string[] = [];
  const hopsRaw = (process.env.TRUST_PROXY_HOPS || "").trim();
  let trustProxyHops: number | null = null;
  if (hopsRaw !== "") {
    const n = Number(hopsRaw);
    if (Number.isInteger(n) && n >= 1 && n <= 10) trustProxyHops = n;
    else invalid.push("TRUST_PROXY_HOPS");
  }
  return {
    credentialsSource: envEnum(
      "EFI_CREDENTIALS_SOURCE",
      ["legacy_env", "database"] as const,
      "legacy_env",
      invalid
    ),
    pixChargeV2Enabled: envStrictBool("EFI_PIX_CHARGE_V2_ENABLED", invalid),
    webhookPipeline: envEnum(
      "EFI_WEBHOOK_PIPELINE",
      ["legacy", "async"] as const,
      "legacy",
      invalid
    ),
    webhookWorkerPaused: envStrictBool("EFI_WEBHOOK_WORKER_PAUSED", invalid),
    pixReconciliationSweepEnabled: envStrictBool(
      "EFI_PIX_RECONCILIATION_SWEEP_ENABLED",
      invalid
    ),
    trustProxyHops,
    invalid
  };
}
