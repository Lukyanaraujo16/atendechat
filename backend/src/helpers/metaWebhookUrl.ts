export const buildMetaWebhookCallbackUrl = (): string => {
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  if (!base) {
    return "/webhooks/meta";
  }
  const port = process.env.PROXY_PORT?.trim();
  const withPort =
    port && !base.match(/:\d+$/) && !base.startsWith("https://")
      ? `${base}:${port}`
      : base;
  return `${withPort}/webhooks/meta`;
};

export const getMetaWebhookVerifyToken = (): string | null => {
  const token = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  return token || null;
};

export const hasMetaWebhookVerifyToken = (): boolean =>
  Boolean(getMetaWebhookVerifyToken());

export const hasMetaAppSecret = (): boolean =>
  Boolean(process.env.META_APP_SECRET?.trim());
