import axios from "axios";
import { logger } from "../../utils/logger";
import GetOneSignalServerSettingsService from "./GetOneSignalServerSettingsService";
import { filterOutUsersViewingTicket } from "../../libs/cache";
import persistInAppNotificationsFromPush from "../UserNotificationService/persistInAppNotificationsFromPush";
import {
  PushPreferenceCategory,
  filterUserIdsByPushPreference,
  loadEffectivePreferencesMap
} from "./userPushPreferences";

const ONESIGNAL_NOTIFICATIONS_URL =
  "https://api.onesignal.com/notifications";

export type PushNotificationData = {
  type: string;
  companyId: number;
  ticketId?: number;
  ticketUuid?: string;
  chatId?: number;
  chatUuid?: string;
  status?: string;
  targetUrl?: string;
  meta?: Record<string, unknown>;
};

/** @deprecated alias — manter compatibilidade com callers de ticket. */
export type TicketPushNotificationData = PushNotificationData & {
  ticketId: number;
  status: string;
};

export type SendPushParams = {
  eventType: string;
  /**
   * Categoria de preferência push. `null` = sem filtro de categoria
   * (ex.: chat interno — não há preferência dedicada sem migration).
   */
  preferenceCategory: PushPreferenceCategory | null;
  companyId: number;
  ticketId?: number | null;
  chatId?: number | null;
  messageId?: string | number | null;
  /** Destinatários internos (IDs de utilizador); filtros aplicam-se antes do OneSignal. */
  recipientUserIds: number[];
  title: string;
  body: string;
  data: PushNotificationData;
  excludeUserIds?: number[];
  /** Default: true quando `ticketId` está definido. */
  applyActiveTicketViewFilter?: boolean;
};

/** Alias histórico. */
export type SendTicketPushParams = SendPushParams;

function summarizeApiResponse(data: unknown): Record<string, unknown> {
  if (data == null || typeof data !== "object") {
    return { raw: String(data) };
  }
  const d = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (d.id != null) out.id = d.id;
  if (d.errors != null) out.errors = d.errors;
  if (d.warnings != null) out.warnings = d.warnings;
  if (d.recipients != null) out.recipients = d.recipients;
  if (d.external_id_errors != null) out.external_id_errors = d.external_id_errors;
  return Object.keys(out).length ? out : { keys: Object.keys(d) };
}

const SendOneSignalPushNotificationService = async (
  params: SendPushParams
): Promise<void> => {
  const {
    eventType,
    preferenceCategory,
    companyId,
    ticketId = null,
    chatId = null,
    messageId,
    title,
    body,
    data,
    excludeUserIds = []
  } = params;

  const applyActiveTicketViewFilter =
    params.applyActiveTicketViewFilter !== undefined
      ? params.applyActiveTicketViewFilter
      : ticketId != null && !Number.isNaN(Number(ticketId));

  const exclude = new Set(
    excludeUserIds.map(id => String(id)).filter(Boolean)
  );

  const recipientsBeforeFilters = [
    ...new Set(
      params.recipientUserIds
        .map(id => Number(id))
        .filter(id => id != null && !Number.isNaN(id) && !exclude.has(String(id)))
    )
  ];

  const logBase = {
    eventType,
    preferenceCategory,
    companyId,
    ticketId,
    chatId,
    messageId,
    recipientsBeforeFilters,
    skippedActiveView: [] as number[],
    skippedByPreferences: [] as number[],
    finalRecipients: [] as number[]
  };

  if (!recipientsBeforeFilters.length) {
    logger.info(
      { ...logBase, skipped: "no_recipients_before_filters", recipientCount: 0 },
      "[OneSignalPush]"
    );
    return;
  }

  let afterActiveView = recipientsBeforeFilters;
  if (applyActiveTicketViewFilter && ticketId != null) {
    const filtered = await filterOutUsersViewingTicket(
      companyId,
      Number(ticketId),
      recipientsBeforeFilters
    );
    afterActiveView = filtered.kept;
    logBase.skippedActiveView = filtered.skippedActiveView;
  }

  let finalUserIds = afterActiveView;
  if (preferenceCategory != null) {
    const prefMap = await loadEffectivePreferencesMap(companyId, afterActiveView);
    const filteredPrefs = filterUserIdsByPushPreference(
      afterActiveView,
      preferenceCategory,
      prefMap
    );
    finalUserIds = filteredPrefs.kept;
    logBase.skippedByPreferences = filteredPrefs.skippedByPreferences;
  }

  logBase.finalRecipients = finalUserIds;

  if (finalUserIds.length === 0) {
    logger.info(
      {
        ...logBase,
        recipientCount: 0,
        recipients: [],
        skipped: "no_recipients_after_filters"
      },
      "[OneSignalPush]"
    );
    return;
  }

  const inAppPayload: Record<string, unknown> = {
    type: data.type,
    companyId: data.companyId
  };
  if (data.ticketId != null) inAppPayload.ticketId = data.ticketId;
  if (data.ticketUuid != null) inAppPayload.ticketUuid = data.ticketUuid;
  if (data.chatId != null) inAppPayload.chatId = data.chatId;
  if (data.chatUuid != null) inAppPayload.chatUuid = data.chatUuid;
  if (data.status != null) inAppPayload.status = data.status;
  if (data.targetUrl != null) inAppPayload.targetUrl = data.targetUrl;
  if (data.meta != null) inAppPayload.meta = data.meta;

  try {
    await persistInAppNotificationsFromPush({
      userIds: finalUserIds,
      companyId,
      type: eventType,
      title,
      body,
      data: inAppPayload
    });
  } catch (err) {
    logger.warn(
      { err, eventType, companyId, ticketId, chatId },
      "[UserNotification] batch_persist_failed"
    );
  }

  const externalUserIds = finalUserIds.map(id => String(id));

  const settings = await GetOneSignalServerSettingsService();
  if (!settings.enabled || !settings.appId || !settings.restApiKey) {
    logger.info(
      {
        ...logBase,
        recipientCount: externalUserIds.length,
        skipped: "disabled_or_incomplete_config",
        inAppPersisted: true
      },
      "[OneSignalPush]"
    );
    return;
  }

  try {
    const res = await axios.post(
      ONESIGNAL_NOTIFICATIONS_URL,
      {
        app_id: settings.appId,
        include_external_user_ids: externalUserIds,
        headings: { en: title, pt: title },
        contents: { en: body, pt: body },
        data: data as Record<string, unknown>
      },
      {
        headers: {
          Authorization: `Key ${settings.restApiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    logger.info(
      {
        ...logBase,
        recipientCount: externalUserIds.length,
        recipients: externalUserIds,
        success: true,
        api: summarizeApiResponse(res.data)
      },
      "[OneSignalPush]"
    );
  } catch (err: unknown) {
    const ax = err as { response?: { data?: unknown; status?: number } };
    logger.warn(
      {
        ...logBase,
        recipientCount: externalUserIds.length,
        recipients: externalUserIds,
        success: false,
        httpStatus: ax.response?.status,
        api: summarizeApiResponse(ax.response?.data)
      },
      "[OneSignalPush]"
    );
  }
};

export default SendOneSignalPushNotificationService;
