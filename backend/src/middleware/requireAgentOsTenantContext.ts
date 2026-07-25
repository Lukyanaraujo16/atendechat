import { NextFunction, Request, Response } from "express";
import { resolveRequestCompanyContext } from "../helpers/resolveRequestCompanyContext";

/**
 * Valida empresa ativa da sessão e rejeita companyId arbitrário.
 * Deve rodar após autenticação e gate de plataforma.
 */
export default function requireAgentOsTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const ctx = resolveRequestCompanyContext(req);
    (req as Request & { agentOsCompanyContext?: typeof ctx }).agentOsCompanyContext =
      ctx;
    next();
  } catch (err) {
    next(err);
  }
}
