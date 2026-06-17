import AppError from "../../errors/AppError";
import { hasEncryptedMetaToken } from "../../helpers/metaTokenCrypto";
import InstagramAccount from "../../models/InstagramAccount";
import MetaWebhookEvent from "../../models/MetaWebhookEvent";
import { parseInstagramWebhookPayload } from "./InstagramWebhookParser";
import {
  collectSubscribedFields,
  fetchInstagramSubscribedApps,
  isSubscribedToMessages
} from "./InstagramWebhookSubscriptionService";
import resolveInstagramAccountToken from "./resolveInstagramAccountToken";

export type WebhookAccountStatus = "confirmed" | "pending" | "error" | "unavailable";

export interface InstagramWebhookDiagnostics {
  instagramBusinessAccountId: string | null;
  status: string;
  hasToken: boolean;
  subscribedAppsQueried: boolean;
  subscribedApps: Array<{
    id?: string;
    name?: string;
    subscribedFields: string[];
  }>;
  subscribedFields: string[];
  isSubscribedToMessages: boolean;
  webhookAccountStatus: WebhookAccountStatus;
  lastWebhookEventAt: string | null;
  lastMappedEventAt: string | null;
  lastUnmappedEventAt: string | null;
  appMode: "unknown";
  recommendations: string[];
  subscriptionQueryError?: string;
}

const buildRecommendations = (input: {
  hasToken: boolean;
  instagramBusinessAccountId: string | null;
  isSubscribedToMessages: boolean;
  subscribedAppsQueried: boolean;
  status: string;
}): string[] => {
  const recommendations: string[] = [];

  if (input.status !== "CONNECTED") {
    recommendations.push("Conecte a conta Instagram com um token válido.");
  }

  if (!input.hasToken) {
    recommendations.push("Configure o token de acesso da conta no AtendeChat.");
  }

  if (!input.instagramBusinessAccountId) {
    recommendations.push("Instagram Business ID ausente — reconecte o token da conta.");
  }

  if (input.subscribedAppsQueried && !input.isSubscribedToMessages) {
    recommendations.push(
      "Assine o campo messages via subscribed_apps na conta Instagram (botão Assinar webhook)."
    );
  }

  if (!input.subscribedAppsQueried && input.hasToken) {
    recommendations.push(
      "Não foi possível consultar subscribed_apps na Meta — verifique o token e permissões."
    );
  }

  recommendations.push(
    "O app Meta precisa estar em modo Live para receber webhooks de DMs reais."
  );
  recommendations.push(
    "Para usuários fora dos testadores, é necessário Advanced Access em instagram_business_manage_messages."
  );

  return recommendations;
};

const resolveWebhookAccountStatus = (input: {
  hasToken: boolean;
  instagramBusinessAccountId: string | null;
  subscribedAppsQueried: boolean;
  isSubscribedToMessages: boolean;
}): WebhookAccountStatus => {
  if (!input.hasToken || !input.instagramBusinessAccountId) {
    return "unavailable";
  }

  if (!input.subscribedAppsQueried) {
    return "error";
  }

  return input.isSubscribedToMessages ? "confirmed" : "pending";
};

const findLastUnmappedEventAt = async (
  instagramBusinessAccountId: string
): Promise<Date | null> => {
  const candidates = await MetaWebhookEvent.findAll({
    where: {
      instagramAccountId: null,
      object: "instagram"
    },
    order: [["receivedAt", "DESC"]],
    limit: 100
  });

  for (const event of candidates) {
    if (!event.rawPayload) continue;
    const parsed = parseInstagramWebhookPayload(
      event.rawPayload as Record<string, unknown>
    );
    const matches = parsed.some(
      item =>
        item.instagramBusinessAccountId === instagramBusinessAccountId ||
        item.recipientId === instagramBusinessAccountId ||
        item.entryId === instagramBusinessAccountId
    );
    if (matches) {
      return event.receivedAt;
    }
  }

  return null;
};

interface Request {
  instagramAccountId: string;
  companyId: number;
}

const GetInstagramWebhookDiagnosticsService = async ({
  instagramAccountId,
  companyId
}: Request): Promise<InstagramWebhookDiagnostics> => {
  const account = await InstagramAccount.findOne({
    where: { id: instagramAccountId, companyId }
  });

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  const hasToken = hasEncryptedMetaToken(account.pageAccessToken);
  const instagramBusinessAccountId = account.instagramBusinessAccountId;

  let subscribedAppsQueried = false;
  let subscribedApps: InstagramWebhookDiagnostics["subscribedApps"] = [];
  let subscribedFields: string[] = [];
  let isSubscribed = false;
  let subscriptionQueryError: string | undefined;

  if (hasToken && instagramBusinessAccountId) {
    try {
      const { accessToken } = await resolveInstagramAccountToken(
        instagramAccountId,
        companyId
      );
      const result = await fetchInstagramSubscribedApps(
        instagramBusinessAccountId,
        accessToken
      );
      subscribedAppsQueried = result.queried;
      subscribedApps = result.apps;
      subscribedFields = collectSubscribedFields(result);
      isSubscribed = isSubscribedToMessages(subscribedFields);
      subscriptionQueryError = result.errorMessage;
    } catch (err) {
      subscribedAppsQueried = false;
      if (err instanceof AppError && err.clientMessage) {
        subscriptionQueryError = err.clientMessage;
      }
    }
  }

  const mappedEvent = await MetaWebhookEvent.findOne({
    where: { instagramAccountId: account.id },
    order: [["receivedAt", "DESC"]]
  });

  let lastUnmappedEventAt: Date | null = null;
  if (instagramBusinessAccountId) {
    lastUnmappedEventAt = await findLastUnmappedEventAt(
      instagramBusinessAccountId
    );
  }

  const webhookAccountStatus = resolveWebhookAccountStatus({
    hasToken,
    instagramBusinessAccountId,
    subscribedAppsQueried,
    isSubscribedToMessages: isSubscribed
  });

  const recommendations = buildRecommendations({
    hasToken,
    instagramBusinessAccountId,
    isSubscribedToMessages: isSubscribed,
    subscribedAppsQueried,
    status: account.status
  });

  return {
    instagramBusinessAccountId,
    status: account.status,
    hasToken,
    subscribedAppsQueried,
    subscribedApps,
    subscribedFields,
    isSubscribedToMessages: isSubscribed,
    webhookAccountStatus,
    lastWebhookEventAt: mappedEvent?.receivedAt?.toISOString() ?? null,
    lastMappedEventAt: mappedEvent?.receivedAt?.toISOString() ?? null,
    lastUnmappedEventAt: lastUnmappedEventAt?.toISOString() ?? null,
    appMode: "unknown",
    recommendations,
    ...(subscriptionQueryError ? { subscriptionQueryError } : {})
  };
};

export default GetInstagramWebhookDiagnosticsService;
