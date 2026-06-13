import AppError from "../../errors/AppError";
import {
  assertMetaTokenEncryptionConfigured,
  encryptMetaToken
} from "../../helpers/metaTokenCrypto";
import { sanitizeInstagramAccount } from "../../helpers/sanitizeInstagramAccount";
import InstagramAccount from "../../models/InstagramAccount";
import {
  assertRequiredInstagramScopes,
  debugMetaAccessToken,
  fetchInstagramBusinessProfile
} from "./MetaGraphApiService";

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

  const debugData = await debugMetaAccessToken(token);

  if (!debugData.isValid) {
    throw new AppError(
      "ERR_INSTAGRAM_TOKEN_INVALID",
      400,
      "O token informado é inválido ou expirou. Gere um novo token no Meta for Developers."
    );
  }

  assertRequiredInstagramScopes(debugData.scopes);

  const profile = await fetchInstagramBusinessProfile(token, debugData);

  const encryptedToken = encryptMetaToken(token);

  await account.update({
    status: "CONNECTED",
    pageAccessToken: encryptedToken,
    tokenExpiresAt: debugData.expiresAt,
    scopes: JSON.stringify(debugData.scopes),
    instagramBusinessAccountId: profile.instagramBusinessAccountId,
    facebookPageId: profile.facebookPageId,
    profilePicUrl: profile.profilePicUrl || account.profilePicUrl,
    name: profile.name || account.name
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
