import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { resolveRequestCompanyContext } from "../helpers/resolveRequestCompanyContext";

/**
 * Auditoria estruturada de mutações técnicas AgentOS (sem PII/credenciais/payloads).
 */
export function logAgentOsTechnicalWrite(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = Date.now();
    res.on("finish", () => {
      try {
        let companyContextId: number | null = null;
        try {
          companyContextId = resolveRequestCompanyContext(req).companyId;
        } catch {
          companyContextId = null;
        }
        const targetId =
          req.params?.id ||
          req.params?.jobId ||
          req.params?.alertId ||
          req.params?.traceId ||
          undefined;
        logger.info(
          {
            event: "agentos.technical_write",
            internalUserId: req.user?.id ?? null,
            permissionKey: action,
            companyContextId,
            route: `${req.method} ${req.baseUrl || ""}${req.path || ""}`,
            action,
            targetType: req.params?.id ? "id" : null,
            targetId: targetId != null ? String(targetId) : null,
            statusCode: res.statusCode,
            result: res.statusCode < 400 ? "ok" : "error",
            durationMs: Date.now() - started,
            supportMode: req.user?.supportMode === true
          },
          "agentos.technical_write"
        );
      } catch {
        /* never break response */
      }
    });
    next();
  };
}

export default logAgentOsTechnicalWrite;
