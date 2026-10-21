import { logger } from "../../utils/logger";

/**
 * URL do webhook PIX configurada na Efí/Gerencianet (formato atual, `?token=`).
 * Usada pelo checkout legado e pelo cadastro admin da B3.2 (RF2.7: com o pipeline `legacy`,
 * o cadastro usa o formato atual para não parar as notificações).
 */
export function buildSubscriptionWebhookUrl(): string {
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  const path = "/subscription/webhook";
  if (!base) {
    logger.warn(
      "[subscription] BACKEND_URL ausente — configure para registrar webhook PIX corretamente"
    );
    return path;
  }
  const secret = process.env.WEBHOOK_SUBSCRIPTION_SECRET;
  if (secret) {
    return `${base}${path}?token=${encodeURIComponent(secret)}`;
  }
  return `${base}${path}`;
}

/**
 * Formato novo da URL (B3.3, D-P3/R-9, PT-2/PT-5): token em `whToken` e `ignorar=` no fim,
 * para o `/pix` que a Efí acrescenta cair no parâmetro descartado (doc oficial, exemplo
 * `?hmac=xyz&ignorar=`). Só é cadastrado com o pipeline `async` ativo (RF2.7, T-ACT-08);
 * a validação em sandbox do path/query recebidos segue pendente (P-B32-01).
 */
export function buildSubscriptionWebhookUrlV2(secret: string): string {
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  return `${base}/subscription/webhook?whToken=${encodeURIComponent(secret)}&ignorar=`;
}
