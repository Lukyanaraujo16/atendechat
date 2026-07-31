import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Auditoria estruturada de mutações Product AI Agent em modo suporte.
 * Sem secrets, sem prompt completo, sem payloads sensíveis.
 */
export function logAiAgentProductSupportWrite(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.supportMode !== true) {
      return next();
    }

    const started = Date.now();
    res.on("finish", () => {
      try {
        const agentRef =
          (req.params as { agentRef?: string })?.agentRef ||
          (req.body as { agentRef?: string })?.agentRef ||
          (req.query as { agentRef?: string })?.agentRef ||
          null;
        const credentialRef =
          (req.params as { credentialRef?: string })?.credentialRef || null;
        const sessionRef =
          (req.params as { sessionRef?: string })?.sessionRef || null;

        logger.info(
          {
            event: "ai_agent.product.support_write",
            actorUserId: req.user?.id ?? null,
            targetCompanyId: req.user?.companyId ?? null,
            supportHomeCompanyId: req.user?.supportHomeCompanyId ?? null,
            supportMode: true,
            action,
            resource: action,
            agentRef: agentRef != null ? String(agentRef) : null,
            credentialRef:
              credentialRef != null ? String(credentialRef) : null,
            sessionRef: sessionRef != null ? String(sessionRef) : null,
            route: `${req.method} ${req.baseUrl || ""}${req.path || ""}`,
            statusCode: res.statusCode,
            result: res.statusCode < 400 ? "ok" : "error",
            durationMs: Date.now() - started
          },
          "ai_agent.product.support_write"
        );
      } catch {
        /* never break response */
      }
    });
    return next();
  };
}

export default logAiAgentProductSupportWrite;
