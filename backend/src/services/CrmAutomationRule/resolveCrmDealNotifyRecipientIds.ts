import CrmDeal from "../../models/CrmDeal";
import User from "../../models/User";

/** Destinatários in-app: responsável do deal ou, na ausência, admins da empresa. */
export default async function resolveCrmDealNotifyRecipientIds(
  deal: CrmDeal
): Promise<number[]> {
  const companyId = deal.companyId;
  const recipientIds: number[] = [];

  if (deal.assignedUserId != null) {
    const assignee = await User.findOne({
      where: { id: deal.assignedUserId, companyId },
      attributes: ["id"]
    });
    if (assignee) {
      recipientIds.push(assignee.id);
    }
  }

  if (recipientIds.length === 0) {
    const admins = await User.findAll({
      where: { companyId, profile: "admin" },
      attributes: ["id"]
    });
    admins.forEach((a) => recipientIds.push(a.id));
  }

  return [...new Set(recipientIds)];
}
