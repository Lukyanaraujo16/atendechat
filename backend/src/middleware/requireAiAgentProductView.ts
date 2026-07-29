import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

/**
 * Acesso comercial à Product API do Agente de IA.
 * Alinhado à superfície que abre /ai-agent (menu + rotas):
 * profile === "admin" — supervisor/user comum não visualizam o módulo.
 * Feature de plano / permissão granular são avaliadas no Experience service
 * (plano off → unavailable; user feature off → 403).
 * supportMode e grants AgentOS NÃO autorizam.
 */
export default function requireAiAgentProductView(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const profile = String(req.user?.profile || "").toLowerCase();
  if (profile !== "admin") {
    return next(
      new AppError(
        "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
        403,
        "Acesso ao Agente de IA não permitido para este perfil."
      )
    );
  }
  return next();
}
