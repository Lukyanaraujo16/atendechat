import { Request } from "express";
import AppError from "../errors/AppError";

export type RequestCompanyContext = {
  companyId: number;
  userId: number;
  supportMode: boolean;
  supportHomeCompanyId: number | null;
};

function parsePositiveId(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * Empresa ativa da sessão (inclui tenant em supportMode).
 * Não concede autorização — apenas resolve contexto.
 * Rejeita companyId arbitrário em query/body diferente da sessão.
 */
export function resolveRequestCompanyContext(
  req: Request
): RequestCompanyContext {
  const sessionCompanyId = parsePositiveId(req.user?.companyId);
  if (sessionCompanyId == null) {
    throw new AppError(
      "ERR_AGENTOS_TENANT_CONTEXT_REQUIRED",
      403,
      "Contexto de empresa obrigatório."
    );
  }

  const claimedQuery = parsePositiveId(req.query?.companyId);
  const claimedBody = parsePositiveId(
    req.body && typeof req.body === "object"
      ? (req.body as { companyId?: unknown }).companyId
      : undefined
  );

  if (claimedQuery != null && claimedQuery !== sessionCompanyId) {
    throw new AppError(
      "ERR_AGENTOS_TENANT_ACCESS_DENIED",
      403,
      "Contexto de empresa inválido."
    );
  }
  if (claimedBody != null && claimedBody !== sessionCompanyId) {
    throw new AppError(
      "ERR_AGENTOS_TENANT_ACCESS_DENIED",
      403,
      "Contexto de empresa inválido."
    );
  }

  const userId = parsePositiveId(req.user?.id);
  if (userId == null) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  return {
    companyId: sessionCompanyId,
    userId,
    supportMode: req.user?.supportMode === true,
    supportHomeCompanyId: parsePositiveId(req.user?.supportHomeCompanyId)
  };
}

export default resolveRequestCompanyContext;
