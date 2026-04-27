import { Request } from "express";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import UserNotification from "../../models/UserNotification";

export type NotificationRequestContext = {
  userId: number;
  jwtCompanyId: number | null;
  isSuper: boolean;
};

export async function loadNotificationRequestContext(
  req: Request
): Promise<NotificationRequestContext> {
  const userId = Number(req.user.id);
  if (Number.isNaN(userId)) {
    throw new AppError("ERR_INVALID_USER", 400);
  }
  const raw = (req.user as { companyId?: number | null }).companyId;
  const jwtCompanyId =
    raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0
      ? Number(raw)
      : null;
  const row = await User.findByPk(userId, { attributes: ["super"] });
  const isSuper = Boolean(row?.super);
  return { userId, jwtCompanyId, isSuper };
}

export function assertTenantCompany(ctx: NotificationRequestContext): void {
  if (!ctx.isSuper && (ctx.jwtCompanyId == null || ctx.jwtCompanyId < 1)) {
    throw new AppError("ERR_NO_COMPANY_CONTEXT", 400);
  }
}

export function userOwnsNotification(
  n: UserNotification,
  ctx: NotificationRequestContext
): boolean {
  if (n.userId !== ctx.userId) {
    return false;
  }
  if (!ctx.isSuper) {
    return n.companyId === ctx.jwtCompanyId;
  }
  if (ctx.jwtCompanyId != null && ctx.jwtCompanyId > 0) {
    return n.companyId == null || Number(n.companyId) === ctx.jwtCompanyId;
  }
  return true;
}
