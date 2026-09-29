import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { campaignQueue } from "../../queues";
import { buildDispatchCampaignJobId } from "./campaignQueueJobIds";

export async function CancelService(id: number, companyId: number) {
  const campaign = await Campaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("ERR_CAMPAIGN_NOT_FOUND", 404);
  }

  await campaign.update({ status: "CANCELADA" });

  const recordsToCancel = await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      deliveredAt: null
    }
  });

  const promises = [];

  for (const record of recordsToCancel) {
    const idsToRemove = new Set<string>();
    if (record.jobId) {
      idsToRemove.add(String(record.jobId));
    }
    idsToRemove.add(buildDispatchCampaignJobId(record.id));

    for (const jobKey of idsToRemove) {
      const job = await campaignQueue.getJob(jobKey);
      if (job) {
        promises.push(job.remove());
      }
    }
  }

  await Promise.all(promises);
}
