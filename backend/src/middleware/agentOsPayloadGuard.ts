import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { AGENTOS_PAYLOAD_LIMITS } from "../config/automationAgentOsSecurityConstants";

/**
 * Limite DoS de payload JSON em rotas AgentOS.
 */
export default function agentOsPayloadGuard(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    if (req.body != null && typeof req.body === "object") {
      const size = JSON.stringify(req.body).length;
      if (size > AGENTOS_PAYLOAD_LIMITS.maxJsonBytes) {
        return next(
          new AppError("ERR_PAYLOAD_TOO_LARGE", 413, "Payload excede limite")
        );
      }
    }
    return next();
  } catch {
    return next(new AppError("ERR_VALIDATION", 400, "Payload inválido"));
  }
}
