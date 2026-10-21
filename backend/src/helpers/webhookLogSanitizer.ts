import { Request, Response } from "express";
import { logger } from "../utils/logger";

/**
 * Fase 8.3-B3.3 (R-17, S2): a rota do webhook Efí carrega o token na query (R-8).
 * Logs e Sentry dessa rota saem sem query, sem Authorization, sem cookies e sem corpo.
 */
export const SUBSCRIPTION_WEBHOOK_PATH = "/subscription/webhook";

export function isSubscriptionWebhookPath(p: string | undefined | null): boolean {
  const path = String(p || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .split("?")[0];
  return path.startsWith(SUBSCRIPTION_WEBHOOK_PATH);
}

/** Caminho seguro para log: sem query na rota do webhook; demais rotas inalteradas. */
export function safeRequestPath(p: string | undefined): string | undefined {
  return isSubscriptionWebhookPath(p) ? String(p || "").split("?")[0] : p;
}

/** `beforeSend` do Sentry. */
export function scrubWebhookSentryEvent<T extends { request?: any }>(event: T): T {
  const request = event?.request;
  if (request && isSubscriptionWebhookPath(request.url)) {
    request.url = String(request.url || "").split("?")[0];
    delete request.query_string;
    delete request.cookies;
    delete request.data;
    if (request.headers) {
      const headers = { ...request.headers };
      Object.keys(headers).forEach(k => {
        if (/^(authorization|cookie)$/i.test(k)) delete headers[k];
      });
      request.headers = headers;
    }
  }
  return event;
}

/**
 * Erro na rota do webhook (handler global de app.ts): log sem query, sem corpo bruto (dados do
 * pagador) e sem stack. No pipeline async, JSON inválido vira 400 (RF3.2); o resto mantém o 500
 * atual (legado inalterado).
 */
export function respondWebhookRouteError(
  err: any,
  req: Pick<Request, "originalUrl" | "url">,
  res: Response,
  asyncActive: boolean
): Response {
  const pathStr = req.originalUrl || req.url || "";
  logger.error({ path: safeRequestPath(pathStr), type: err?.type || err?.name }, "[webhook] erro na rota");
  if (err?.type === "entity.parse.failed" && asyncActive) {
    return res.status(400).json({ error: "ERR_WEBHOOK_INVALID_BODY" });
  }
  return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
}
