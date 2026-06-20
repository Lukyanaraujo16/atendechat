import AppError from "../../errors/AppError";
import { hasEncryptedMetaToken } from "../../helpers/metaTokenCrypto";
import InstagramAccount from "../../models/InstagramAccount";

interface Request {
  instagramAccountId: string;
  companyId: number;
}

export interface InstagramOAuthStatusResult {
  status: string;
  connectedVia: string | null;
  hasToken: boolean;
  tokenExpiresAt: Date | null;
  tokenRefreshedAt: Date | null;
  connectionError: string | null;
  metaUserId: string | null;
}

const GetInstagramOAuthStatusService = async ({
  instagramAccountId,
  companyId
}: Request): Promise<InstagramOAuthStatusResult> => {
  const account = await InstagramAccount.findOne({
    where: { id: instagramAccountId, companyId }
  });

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  return {
    status: account.status,
    connectedVia: account.connectedVia ?? null,
    hasToken: hasEncryptedMetaToken(account.pageAccessToken),
    tokenExpiresAt: account.tokenExpiresAt ?? null,
    tokenRefreshedAt: account.tokenRefreshedAt ?? null,
    connectionError: account.connectionError ?? null,
    metaUserId: account.metaUserId ?? null
  };
};

export default GetInstagramOAuthStatusService;
