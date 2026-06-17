import AppError from "../../errors/AppError";
import {
  decryptMetaToken,
  hasEncryptedMetaToken
} from "../../helpers/metaTokenCrypto";
import InstagramAccount from "../../models/InstagramAccount";

const resolveInstagramAccountToken = async (
  instagramAccountId: string | number,
  companyId: number
): Promise<{ account: InstagramAccount; accessToken: string }> => {
  const account = await InstagramAccount.findOne({
    where: { id: instagramAccountId, companyId }
  });

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  if (!hasEncryptedMetaToken(account.pageAccessToken)) {
    throw new AppError(
      "ERR_INSTAGRAM_TOKEN_NOT_CONFIGURED",
      400,
      "Conta sem token configurado. Conecte o token da Meta primeiro."
    );
  }

  if (!account.instagramBusinessAccountId) {
    throw new AppError(
      "ERR_INSTAGRAM_BUSINESS_ID_MISSING",
      400,
      "Instagram Business ID ausente. Reconecte o token da conta."
    );
  }

  const accessToken = decryptMetaToken(account.pageAccessToken as string);

  return { account, accessToken };
};

export default resolveInstagramAccountToken;
