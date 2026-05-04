import { Request } from "express";
import Company from "../../models/Company";

export type CrmVisibilityMode = "all" | "assigned";

export function normalizeCrmVisibilityMode(raw: unknown): CrmVisibilityMode {
  return raw === "assigned" ? "assigned" : "all";
}

export async function getCrmVisibilityModeForCompany(
  companyId: number
): Promise<CrmVisibilityMode> {
  const row = await Company.findByPk(companyId, {
    attributes: ["crmVisibilityMode"]
  });
  return normalizeCrmVisibilityMode(row?.crmVisibilityMode);
}

/** Admin ou modo suporte: veem todos os deals do tenant. */
export function userSeesAllCrmDeals(req: Request): boolean {
  const u = req.user;
  if (!u) return false;
  if (u.profile === "admin") return true;
  if (u.supportMode === true) return true;
  return false;
}

/**
 * Quando `assigned`, utilizadores não admin veem só os próprios deals.
 * Retorna o userId a filtrar, ou `null` se não aplicar filtro extra.
 */
export function getForcedAssignedUserIdForRequest(
  req: Request,
  mode: CrmVisibilityMode
): number | null {
  if (mode !== "assigned") return null;
  if (userSeesAllCrmDeals(req)) return null;
  const id = req.user?.id;
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}
