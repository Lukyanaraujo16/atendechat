import CrmDeal from "../../models/CrmDeal";
import CrmDealActivity from "../../models/CrmDealActivity";
import CrmDealStageHistory from "../../models/CrmDealStageHistory";
import User from "../../models/User";
import CrmStage from "../../models/CrmStage";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

const dealInclude = [
  {
    model: Contact,
    as: "contact",
    attributes: ["id", "name", "number"],
    required: false
  },
  {
    model: User,
    as: "assignedUser",
    attributes: ["id", "name"],
    required: false
  },
  {
    model: Ticket,
    as: "ticket",
    attributes: ["id", "status", "lastMessage", "updatedAt"],
    required: false
  }
];

export default async function GetCrmDealTimelineService(input: {
  companyId: number;
  dealId: number;
  visibilityAssignedUserId?: number | null;
}): Promise<{ deal: CrmDeal | null; activities: CrmDealActivity[]; stageHistory: CrmDealStageHistory[] }> {
  const where: Record<string, unknown> = {
    id: input.dealId,
    companyId: input.companyId
  };
  if (input.visibilityAssignedUserId != null) {
    where.assignedUserId = input.visibilityAssignedUserId;
  }
  const deal = await CrmDeal.findOne({
    where,
    include: dealInclude
  });
  if (!deal) {
    return { deal: null, activities: [], stageHistory: [] };
  }

  const activities = await CrmDealActivity.findAll({
    where: { companyId: input.companyId, dealId: input.dealId },
    include: [
      {
        model: User,
        as: "actor",
        attributes: ["id", "name"],
        required: false
      }
    ],
    order: [["createdAt", "DESC"]]
  });

  const stageHistory = await CrmDealStageHistory.findAll({
    where: { companyId: input.companyId, dealId: input.dealId },
    include: [
      {
        model: CrmStage,
        as: "fromStage",
        attributes: ["id", "name"],
        required: false
      },
      {
        model: CrmStage,
        as: "toStage",
        attributes: ["id", "name"],
        required: false
      },
      {
        model: User,
        as: "changer",
        attributes: ["id", "name"],
        required: false
      }
    ],
    order: [["enteredAt", "DESC"]]
  });

  return { deal, activities, stageHistory };
}
