import Company from "../models/Company";

/**
 * Utilizador pode ver tickets com queueId null quando:
 * - allTicket está enabled; ou
 * - pertence ao setor de contingência da empresa (unassignedTicketsQueueId).
 */
export function allowsNullQueueVisibility(
  userQueueIds: number[] | undefined | null,
  allTicketEnabled: boolean,
  unassignedTicketsQueueId: number | null | undefined
): boolean {
  if (allTicketEnabled) {
    return true;
  }
  const contingencyId =
    unassignedTicketsQueueId != null && unassignedTicketsQueueId !== ("" as unknown)
      ? Number(unassignedTicketsQueueId)
      : null;
  if (contingencyId == null || Number.isNaN(contingencyId)) {
    return false;
  }
  const membership = (userQueueIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  return membership.includes(contingencyId);
}

export async function loadCompanyUnassignedTicketsQueueId(
  companyId: number
): Promise<number | null> {
  const company = await Company.findByPk(companyId, {
    attributes: ["id", "unassignedTicketsQueueId"]
  });
  if (!company) {
    return null;
  }
  const raw = company.unassignedTicketsQueueId;
  if (raw == null || raw === ("" as unknown)) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
