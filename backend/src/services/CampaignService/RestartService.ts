import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import { campaignQueue } from "../../queues";
import { buildProcessCampaignRestartJobId } from "./campaignQueueJobIds";

export async function RestartService(id: number, companyId: number) {
  const campaign = await Campaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("ERR_CAMPAIGN_NOT_FOUND", 404);
  }

  if (campaign.status === "EM_ANDAMENTO") {
    throw new AppError("ERR_CAMPAIGN_INVALID_STATUS", 400);
  }

  await campaign.update({ status: "EM_ANDAMENTO" });

  await campaignQueue.add(
    "ProcessCampaign",
    { id: campaign.id },
    {
      jobId: buildProcessCampaignRestartJobId(campaign.id),
      delay: 3000,
      removeOnComplete: true
    }
  );
}
