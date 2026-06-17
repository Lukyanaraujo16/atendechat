import axios, { AxiosError } from "axios";
import AppError from "../../errors/AppError";
import { redactSensitiveText } from "../../helpers/maskSensitive";
import { logger } from "../../utils/logger";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const INSTAGRAM_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;

export const PREFERRED_WEBHOOK_SUBSCRIBED_FIELDS = [
  "messages",
  "comments",
  "messaging_postbacks",
  "messaging_seen",
  "message_reactions"
] as const;

export interface SubscribedAppEntry {
  id?: string;
  name?: string;
  subscribedFields: string[];
}

export interface SubscribedAppsResult {
  queried: boolean;
  apps: SubscribedAppEntry[];
  errorMessage?: string;
}

export interface SubscribeWebhookResult {
  success: boolean;
  subscribedFields: string[];
  fallbackToMessagesOnly: boolean;
  metaResponse?: Record<string, unknown>;
}

const parseMetaError = (err: unknown): string => {
  const axiosErr = err as AxiosError<{ error?: { message?: string; code?: number } }>;
  const message = axiosErr.response?.data?.error?.message;
  return message ? redactSensitiveText(message) : "Falha ao consultar a API da Meta.";
};

const extractSubscribedFields = (entry: Record<string, unknown>): string[] => {
  const fields = entry.subscribed_fields ?? entry.subscribedFields;
  if (Array.isArray(fields)) {
    return fields.filter((f): f is string => typeof f === "string");
  }
  return [];
};

export const fetchInstagramSubscribedApps = async (
  instagramBusinessAccountId: string,
  accessToken: string
): Promise<SubscribedAppsResult> => {
  try {
    const { data } = await axios.get(`${INSTAGRAM_GRAPH}/${instagramBusinessAccountId}/subscribed_apps`, {
      params: { access_token: accessToken },
      timeout: 15000
    });

    const rows = Array.isArray(data?.data) ? data.data : [];
    const apps: SubscribedAppEntry[] = rows.map((row: Record<string, unknown>) => ({
      id: row.id != null ? String(row.id) : undefined,
      name: typeof row.name === "string" ? row.name : undefined,
      subscribedFields: extractSubscribedFields(row)
    }));

    return { queried: true, apps };
  } catch (err) {
    const errorMessage = parseMetaError(err);
    logger.warn(
      {
        instagramBusinessAccountId,
        errorMessage
      },
      "[InstagramWebhook] subscribed_apps query failed"
    );
    return { queried: false, apps: [], errorMessage };
  }
};

const postSubscribedApps = async (
  instagramBusinessAccountId: string,
  accessToken: string,
  subscribedFields: string[]
): Promise<Record<string, unknown>> => {
  const { data } = await axios.post(
    `${INSTAGRAM_GRAPH}/${instagramBusinessAccountId}/subscribed_apps`,
    null,
    {
      params: {
        subscribed_fields: subscribedFields.join(","),
        access_token: accessToken
      },
      timeout: 15000
    }
  );
  return data as Record<string, unknown>;
};

export const subscribeInstagramAccountWebhook = async (
  instagramBusinessAccountId: string,
  accessToken: string
): Promise<SubscribeWebhookResult> => {
  const preferred = [...PREFERRED_WEBHOOK_SUBSCRIBED_FIELDS];

  try {
    const metaResponse = await postSubscribedApps(
      instagramBusinessAccountId,
      accessToken,
      preferred
    );

    logger.info(
      {
        instagramBusinessAccountId,
        subscribedFields: preferred
      },
      "[InstagramWebhook] subscribed_apps success"
    );

    return {
      success: true,
      subscribedFields: preferred,
      fallbackToMessagesOnly: false,
      metaResponse
    };
  } catch (err) {
    logger.warn(
      {
        instagramBusinessAccountId,
        errorMessage: parseMetaError(err)
      },
      "[InstagramWebhook] subscribed_apps preferred fields failed, trying messages only"
    );

    try {
      const metaResponse = await postSubscribedApps(
        instagramBusinessAccountId,
        accessToken,
        ["messages"]
      );

      logger.info(
        { instagramBusinessAccountId, subscribedFields: ["messages"] },
        "[InstagramWebhook] subscribed_apps success (messages only)"
      );

      return {
        success: true,
        subscribedFields: ["messages"],
        fallbackToMessagesOnly: true,
        metaResponse
      };
    } catch (fallbackErr) {
      throw new AppError(
        "ERR_INSTAGRAM_WEBHOOK_SUBSCRIBE_FAILED",
        400,
        parseMetaError(fallbackErr)
      );
    }
  }
};

export const collectSubscribedFields = (
  subscribedApps: SubscribedAppsResult
): string[] => {
  const fields = new Set<string>();
  subscribedApps.apps.forEach(app => {
    app.subscribedFields.forEach(field => fields.add(field));
  });
  return Array.from(fields);
};

export const isSubscribedToMessages = (fields: string[]): boolean =>
  fields.includes("messages");
