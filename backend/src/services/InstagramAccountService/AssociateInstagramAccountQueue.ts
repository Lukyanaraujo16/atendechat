import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import InstagramAccount from "../../models/InstagramAccount";
import InstagramAccountQueue from "../../models/InstagramAccountQueue";

const AssociateInstagramAccountQueue = async (
  instagramAccount: InstagramAccount,
  queueIds: number[]
): Promise<void> => {
  if (!queueIds.length) {
    await InstagramAccountQueue.destroy({
      where: {
        instagramAccountId: instagramAccount.id,
        companyId: instagramAccount.companyId
      }
    });
    await instagramAccount.reload();
    return;
  }

  const valid = await Queue.count({
    where: {
      id: { [Op.in]: queueIds },
      companyId: instagramAccount.companyId
    }
  });

  if (valid !== queueIds.length) {
    throw new AppError(
      "ERR_QUEUE_INVALID_OR_OTHER_COMPANY",
      403,
      "Um ou mais setores não pertencem a esta empresa."
    );
  }

  await InstagramAccountQueue.destroy({
    where: {
      instagramAccountId: instagramAccount.id,
      companyId: instagramAccount.companyId
    }
  });

  await InstagramAccountQueue.bulkCreate(
    queueIds.map(queueId => ({
      companyId: instagramAccount.companyId,
      instagramAccountId: instagramAccount.id,
      queueId
    }))
  );

  await instagramAccount.reload();
};

export default AssociateInstagramAccountQueue;
