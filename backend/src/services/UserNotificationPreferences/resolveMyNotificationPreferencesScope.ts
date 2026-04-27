import { Request } from "express";
import AppError from "../../errors/AppError";
import User from "../../models/User";

export type NotificationPreferencesScope = {
  userId: number;
  /** null = preferências da plataforma (super sem empresa no JWT) */
  companyId: number | null;
};

/**
 * Utilizador normal: sempre empresa do JWT.
 * Super: empresa do JWT quando existir (contexto tenant); caso contrário âmbito plataforma (companyId null).
 */
export async function resolveMyNotificationPreferencesScope(
  req: Request
): Promise<NotificationPreferencesScope> {
  const userId = Number(req.user.id);
  if (Number.isNaN(userId)) {
    throw new AppError("ERR_INVALID_USER", 400);
  }

  const rawCo = (req.user as { companyId?: number | null }).companyId;
  const jwtCompanyId =
    rawCo != null && Number.isFinite(Number(rawCo)) && Number(rawCo) > 0
      ? Number(rawCo)
      : null;

  const row = await User.findByPk(userId, { attributes: ["super"] });
  const isSuper = Boolean(row?.super);

  if (!isSuper) {
    if (jwtCompanyId == null) {
      throw new AppError("ERR_NO_COMPANY_CONTEXT", 400);
    }
    return { userId, companyId: jwtCompanyId };
  }

  if (jwtCompanyId != null) {
    return { userId, companyId: jwtCompanyId };
  }

  return { userId, companyId: null };
}
