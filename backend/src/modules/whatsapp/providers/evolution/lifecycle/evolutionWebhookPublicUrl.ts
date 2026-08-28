/**
 * URL pública do webhook Evolution apontando ao StreamHub.
 * Usa BACKEND_URL (server-side) — NÃO confia em Host header.
 * Opcional: EVOLUTION_WEBHOOK_PUBLIC_BASE_URL sobrescreve a base.
 */

export function buildEvolutionWebhookPublicBaseUrl(): string | null {
  const dedicated = (
    process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE_URL || ""
  ).trim();
  const base = (dedicated || process.env.BACKEND_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  const port = process.env.PROXY_PORT?.trim();
  if (
    port &&
    !dedicated &&
    !base.match(/:\d+$/) &&
    !base.startsWith("https://")
  ) {
    return `${base}:${port}`;
  }
  return base;
}

export function buildEvolutionWebhookUrl(whatsappId: number): string | null {
  const base = buildEvolutionWebhookPublicBaseUrl();
  if (!base) return null;
  const id = Number(whatsappId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return `${base}/webhooks/evolution/${id}`;
}
