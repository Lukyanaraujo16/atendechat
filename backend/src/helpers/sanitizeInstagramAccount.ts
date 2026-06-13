import InstagramAccount from "../models/InstagramAccount";
import { hasEncryptedMetaToken } from "./metaTokenCrypto";

export type SanitizedInstagramAccount = Record<string, unknown> & {
  hasToken: boolean;
};

export const sanitizeInstagramAccount = (
  account: InstagramAccount
): SanitizedInstagramAccount => {
  const json = account.toJSON() as Record<string, unknown>;
  const hasToken = hasEncryptedMetaToken(json.pageAccessToken as string);
  delete json.pageAccessToken;
  return { ...json, hasToken };
};

export const sanitizeInstagramAccounts = (
  accounts: InstagramAccount[]
): SanitizedInstagramAccount[] => accounts.map(sanitizeInstagramAccount);
