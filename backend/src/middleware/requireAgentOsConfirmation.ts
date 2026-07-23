import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { getAgentOsSecurityConfig } from "../services/AutomationOrchestrator/security/AgentOsSecurityConfig";
import { AGENTOS_SENSITIVE_OPS } from "../config/automationAgentOsSecurityConstants";

function pathLooksSensitive(path: string, method: string): boolean {
  const p = path.toLowerCase();
  const m = method.toUpperCase();
  if (m === "DELETE") return true;
  if (
    p.includes("/approve") ||
    p.includes("/rollback") ||
    p.includes("/promote") ||
    p.includes("/archive") ||
    p.includes("/suspend") ||
    p.includes("/deactivate") ||
    p.includes("/restore") ||
    p.includes("/mass") ||
    p.includes("/observability/ops")
  ) {
    return true;
  }
  if (
    m === "PUT" &&
    (p.includes("/config") || p.includes("/settings") || p.includes("/policies"))
  ) {
    return true;
  }
  return AGENTOS_SENSITIVE_OPS.some(op => p.includes(`/${op}`));
}

/**
 * Exige confirm:true no body para operações sensíveis AgentOS.
 */
export default function requireAgentOsConfirmation(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const cfg = getAgentOsSecurityConfig();
  if (!cfg.requireConfirmationForSensitiveOps) return next();
  if (!pathLooksSensitive(req.path || req.originalUrl || "", req.method)) {
    return next();
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const q = (req.query || {}) as Record<string, unknown>;
  const ok =
    body.confirm === true ||
    body.confirmed === true ||
    body.confirmation === true ||
    q.confirm === "true" ||
    q.confirmed === "true";
  if (!ok) {
    return next(
      new AppError(
        "ERR_CONFIRMATION_REQUIRED",
        400,
        "Operação sensível exige confirm: true"
      )
    );
  }
  return next();
}
