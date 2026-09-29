import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { campaignQueue } from "../../queues";
import { Op } from "sequelize";
import {
  buildDispatchCampaignJobId,
  isBullDuplicateJobError
} from "./campaignQueueJobIds";

export async function RetryFailedService(
  id: number,
  companyId: number
): Promise<{ retried: number }> {
  const campaign = await Campaign.findOne({
    where: { id, companyId },
    attributes: ["id", "status"]
  });

  if (!campaign) {
    throw new AppError("ERR_CAMPAIGN_NOT_FOUND", 404);
  }

  if (campaign.status === "INATIVA" || campaign.status === "PROGRAMADA") {
    throw new AppError("ERR_CAMPAIGN_INVALID_STATUS", 400);
  }

  const rows = await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      deliveredAt: null,
      failedAt: { [Op.not]: null }
    }
  });

  if (rows.length === 0) {
    throw new AppError("ERR_CAMPAIGN_NO_FAILED_TO_RETRY", 400);
  }

  for (const row of rows) {
    const dispatchJobId = buildDispatchCampaignJobId(row.id);

    try {
      const existing = await campaignQueue.getJob(dispatchJobId);
      if (existing) {
        await existing.remove();
      }
    } catch {
      // best-effort: job pode já ter sido limpo
    }

    await row.update({ failedAt: null, jobId: null });

    try {
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        {
          campaignId: campaign.id,
          campaignShippingId: row.id,
          contactListItemId: row.contactId
        },
        {
          jobId: dispatchJobId,
          delay: 0,
          removeOnComplete: true,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000
          }
        }
      );
      await row.update({ jobId: String(nextJob.id) });
    } catch (addErr: unknown) {
      if (isBullDuplicateJobError(addErr)) {
        await row.update({ jobId: dispatchJobId });
        continue;
      }
      throw addErr;
    }
  }

  return { retried: rows.length };
}
