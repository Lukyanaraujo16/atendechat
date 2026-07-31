import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { resolveAiAgentProductManageAccess } from "../helpers/canManageAiAgentProduct";

/**
 * Acesso comercial à Product API do Agente de IA.
 *
 * Autoriza:
 * - profile === "admin" no tenant da sessão (fora do suporte);
 * - Super Admin autenticado em supportMode no tenant alvo (companyId do JWT).
 *
 * Não autoriza: supervisor/user, supportMode sem Super Admin, grants AgentOS.
 * Feature de plano é avaliada nos services (plano off → unavailable).
 */
export default async function requireAiAgentProductView(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const access = await resolveAiAgentProductManageAccess(req.user);
    if (!access.allowed) {
      return next(
        new AppError(
          "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
          403,
          "Acesso ao Agente de IA não permitido para este perfil."
        )
      );
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
