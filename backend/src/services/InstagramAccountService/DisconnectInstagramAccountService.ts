import AppError from "../../errors/AppError";
import { sanitizeInstagramAccount } from "../../helpers/sanitizeInstagramAccount";
import InstagramAccount from "../../models/InstagramAccount";

interface Request {
  instagramAccountId: string;
  companyId: number;
}

const DisconnectInstagramAccountService = async ({
  instagramAccountId,
  companyId
}: Request) => {
  const account = await InstagramAccount.findOne({
    where: { id: instagramAccountId, companyId }
  });

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  await account.update({
    status: "DISCONNECTED",
    pageAccessToken: null,
    tokenExpiresAt: null,
    scopes: null
  });

  await account.reload({
    include: [
      {
        association: "queues",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  return sanitizeInstagramAccount(account);
};

export default DisconnectInstagramAccountService;
