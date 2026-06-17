import resolveInstagramAccountToken from "./resolveInstagramAccountToken";
import {
  SubscribeWebhookResult,
  subscribeInstagramAccountWebhook
} from "./InstagramWebhookSubscriptionService";

interface Request {
  instagramAccountId: string;
  companyId: number;
}

const SubscribeInstagramAccountWebhookService = async ({
  instagramAccountId,
  companyId
}: Request): Promise<SubscribeWebhookResult> => {
  const { account, accessToken } = await resolveInstagramAccountToken(
    instagramAccountId,
    companyId
  );

  return subscribeInstagramAccountWebhook(
    account.instagramBusinessAccountId as string,
    accessToken
  );
};

export default SubscribeInstagramAccountWebhookService;
