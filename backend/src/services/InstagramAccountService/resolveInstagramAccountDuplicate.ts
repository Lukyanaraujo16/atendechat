import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import InstagramAccount from "../../models/InstagramAccount";
import { logger } from "../../utils/logger";

export interface ResolveDuplicateResult {
  targetAccountId: number;
  duplicateStarterAccountId: number | null;
  upgraded: boolean;
}

export const findConnectedDuplicateInstagramAccount = async ({
  companyId,
  instagramBusinessAccountId,
  excludeAccountId
}: {
  companyId: number;
  instagramBusinessAccountId: string;
  excludeAccountId: number;
}): Promise<InstagramAccount | null> =>
  InstagramAccount.findOne({
    where: {
      companyId,
      instagramBusinessAccountId,
      status: "CONNECTED",
      id: { [Op.ne]: excludeAccountId }
    }
  });

export const resolveInstagramAccountDuplicate = async ({
  companyId,
  requestedAccountId,
  instagramBusinessAccountId,
  oauthFlow
}: {
  companyId: number;
  requestedAccountId: number;
  instagramBusinessAccountId: string;
  oauthFlow: boolean;
}): Promise<ResolveDuplicateResult> => {
  const existing = await findConnectedDuplicateInstagramAccount({
    companyId,
    instagramBusinessAccountId,
    excludeAccountId: requestedAccountId
  });

  if (!existing) {
    return {
      targetAccountId: requestedAccountId,
      duplicateStarterAccountId: null,
      upgraded: false
    };
  }

  logger.info(
    {
      companyId,
      requestedAccountId,
      existingAccountId: existing.id,
      instagramBusinessAccountId
    },
    "[InstagramOAuth] duplicate_account_detected"
  );

  if (oauthFlow) {
    logger.info(
      {
        companyId,
        requestedAccountId,
        existingAccountId: existing.id,
        instagramBusinessAccountId
      },
      "[InstagramOAuth] existing_account_upgraded"
    );

    return {
      targetAccountId: existing.id,
      duplicateStarterAccountId: requestedAccountId,
      upgraded: true
    };
  }

  throw new AppError(
    "ERR_INSTAGRAM_ACCOUNT_DUPLICATE",
    400,
    "Esta conta Instagram já está conectada nesta empresa."
  );
};

export const clearDuplicateOAuthStarterAccount = async (
  accountId: number,
  companyId: number
): Promise<void> => {
  await InstagramAccount.update(
    {
      status: "PENDING",
      pageAccessToken: null,
      tokenExpiresAt: null,
      scopes: null,
      instagramBusinessAccountId: null,
      facebookPageId: null,
      connectedVia: null,
      metaUserId: null,
      tokenRefreshedAt: null,
      connectionError: null
    },
    { where: { id: accountId, companyId } }
  );
};
