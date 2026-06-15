import AppError from "../../errors/AppError";
import {
  assertMetaTokenEncryptionConfigured,
  encryptMetaToken
} from "../../helpers/metaTokenCrypto";
import { sanitizeInstagramAccount } from "../../helpers/sanitizeInstagramAccount";
import InstagramAccount from "../../models/InstagramAccount";
import { validateInstagramAccessToken } from "./MetaGraphApiService";

interface Request {
  instagramAccountId: string;
  companyId: number;
  accessToken: string;
}

const ConnectInstagramTokenService = async ({
  instagramAccountId,
  companyId,
  accessToken
}: Request) => {
  const token = accessToken?.trim();
  if (!token) {
    throw new AppError(
      "ERR_INSTAGRAM_TOKEN_INVALID",
      400,
      "Informe um token de acesso válido."
    );
  }

  assertMetaTokenEncryptionConfigured();

  const account = await InstagramAccount.findOne({
    where: { id: instagramAccountId, companyId }
  });

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  const validation = await validateInstagramAccessToken(token);

  const encryptedToken = encryptMetaToken(token);

  await account.update({
    status: "CONNECTED",
    pageAccessToken: encryptedToken,
    tokenExpiresAt: validation.expiresAt,
    scopes: JSON.stringify(validation.scopes),
    instagramBusinessAccountId: validation.profile.instagramBusinessAccountId,
    facebookPageId: validation.profile.facebookPageId,
    profilePicUrl: validation.profile.profilePicUrl || account.profilePicUrl,
    name: validation.profile.name || account.name
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

export default ConnectInstagramTokenService;
