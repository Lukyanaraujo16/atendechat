import { Op } from "sequelize";
import { NotificationRequestContext } from "./notificationRequestContext";

export type NotificationListFilters = {
  readFilter?: boolean;
  /** default = não arquivadas; only = só arquivadas; all = incluir ambas */
  archived?: "default" | "only" | "all";
  search?: string;
  kind?: "ticket" | "appointment" | "billing";
};

export function buildUserNotificationWhere(
  ctx: NotificationRequestContext,
  filters: NotificationListFilters
): Record<string, unknown> {
  const where: Record<string, unknown> = { userId: ctx.userId };

  if (ctx.isSuper) {
    if (ctx.jwtCompanyId != null && ctx.jwtCompanyId > 0) {
      (where as any)[Op.or] = [
        { companyId: ctx.jwtCompanyId },
        { companyId: { [Op.is]: null } }
      ];
    }
  } else {
    where.companyId = ctx.jwtCompanyId;
  }

  const archived = filters.archived ?? "default";
  if (archived === "default") {
    where.archivedAt = { [Op.is]: null };
  } else if (archived === "only") {
    where.archivedAt = { [Op.ne]: null };
  }

  if (filters.readFilter === true) {
    where.read = true;
  } else if (filters.readFilter === false) {
    where.read = false;
  }

  const parts: unknown[] = [where];

  if (filters.search != null && String(filters.search).trim() !== "") {
    const q = `%${String(filters.search).trim()}%`;
    parts.push({
      [Op.or]: [
        { title: { [Op.like]: q } },
        { body: { [Op.like]: q } }
      ]
    });
  }

  if (filters.kind === "ticket") {
    parts.push({ type: { [Op.like]: "ticket_%" } });
  } else if (filters.kind === "appointment") {
    parts.push({ type: { [Op.like]: "appointment_%" } });
  } else if (filters.kind === "billing") {
    parts.push({ type: { [Op.like]: "company_billing_%" } });
  }

  if (parts.length === 1) {
    return where;
  }
  return { [Op.and]: parts };
}
