import AppError from "../../errors/AppError";
import InstagramAccount from "../../models/InstagramAccount";
import InstagramAccountQueue from "../../models/InstagramAccountQueue";

const DeleteInstagramAccountService = async (
  id: string,
  companyId: number
): Promise<void> => {
  const instagramAccount = await InstagramAccount.findOne({
    where: { id, companyId }
  });

  if (!instagramAccount) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  await InstagramAccountQueue.destroy({
    where: { instagramAccountId: instagramAccount.id, companyId }
  });

  await instagramAccount.destroy();
};

export default DeleteInstagramAccountService;
