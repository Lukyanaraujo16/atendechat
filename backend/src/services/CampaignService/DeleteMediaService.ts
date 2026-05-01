import fs from "fs";
import path from "path";

import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import {
  decrementCompanyStorageUsage,
  tryStatFileBytes
} from "../CompanyService/adjustCompanyStorageUsage";

const DeleteMediaService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const campaign = await Campaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("ERR_CAMPAIGN_NOT_FOUND", 404);
  }

  if (campaign.mediaPath) {
    const filePath = path.resolve("public", campaign.mediaPath);
    if (fs.existsSync(filePath)) {
      const sz = tryStatFileBytes(filePath);
      void decrementCompanyStorageUsage(companyId, sz);
      fs.unlinkSync(filePath);
    }
  }

  campaign.mediaPath = null;
  campaign.mediaName = null;
  await campaign.save();
};

export default DeleteMediaService;
