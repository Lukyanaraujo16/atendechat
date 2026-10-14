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
