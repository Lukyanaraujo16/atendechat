import AppError from "../errors/AppError";
import {
  AutoMessageSettingValue,
  CallHandlingMode,
  ChatBotTypeValue,
  GroupMessagesMode,
  ScheduleTypeValue
} from "./whatsappBehaviorSettings";

export type BehaviorSettingsPayload = {
  callHandlingMode?: CallHandlingMode;
  sendMessageOnCallReject?: boolean;
  callRejectMessage?: string | null;
  groupMessagesMode?: GroupMessagesMode;
  sendGreetingAccepted?: AutoMessageSettingValue;
  sendMsgTransfTicket?: AutoMessageSettingValue;
  sendGreetingMessageOneQueues?: AutoMessageSettingValue;
  chatBotType?: ChatBotTypeValue;
  userRating?: AutoMessageSettingValue;
  scheduleType?: ScheduleTypeValue;
};

const ALLOWED_BEHAVIOR_KEYS = new Set([
  "callHandlingMode",
  "sendMessageOnCallReject",
  "callRejectMessage",
  "groupMessagesMode",
  "sendGreetingAccepted",
  "sendMsgTransfTicket",
  "sendGreetingMessageOneQueues",
  "chatBotType",
  "userRating",
  "scheduleType"
]);

const AUTO_MESSAGE_VALUES = new Set(["enabled", "disabled"]);
const SCHEDULE_TYPE_VALUES = new Set(["disabled", "company", "queue"]);

export function assertBehaviorSettingsPayload(
  settings: Record<string, unknown>
): BehaviorSettingsPayload {
  const unknown = Object.keys(settings).filter((k) => !ALLOWED_BEHAVIOR_KEYS.has(k));
  if (unknown.length > 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }
  return settings as BehaviorSettingsPayload;
}

function assertAutoMessageValue(
  value: string,
  field: string
): AutoMessageSettingValue {
  if (!AUTO_MESSAGE_VALUES.has(value)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }
  return value as AutoMessageSettingValue;
}

export function buildWhatsappBehaviorPatch(
  settings: BehaviorSettingsPayload
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (settings.callHandlingMode != null) {
    if (!["accept", "reject"].includes(settings.callHandlingMode)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400);
    }
    patch.callHandlingMode = settings.callHandlingMode;
  }
  if (settings.sendMessageOnCallReject != null) {
    patch.sendMessageOnCallReject = Boolean(settings.sendMessageOnCallReject);
  }
  if (settings.callRejectMessage !== undefined) {
    patch.callRejectMessage =
      settings.callRejectMessage == null
        ? null
        : String(settings.callRejectMessage);
  }
  if (settings.groupMessagesMode != null) {
    if (!["ignore", "receive"].includes(settings.groupMessagesMode)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400);
    }
    patch.groupMessagesMode = settings.groupMessagesMode;
  }
  if (settings.sendGreetingAccepted != null) {
    patch.sendGreetingAccepted = assertAutoMessageValue(
      settings.sendGreetingAccepted,
      "sendGreetingAccepted"
    );
  }
  if (settings.sendMsgTransfTicket != null) {
    patch.sendMsgTransfTicket = assertAutoMessageValue(
      settings.sendMsgTransfTicket,
      "sendMsgTransfTicket"
    );
  }
  if (settings.sendGreetingMessageOneQueues != null) {
    patch.sendGreetingMessageOneQueues = assertAutoMessageValue(
      settings.sendGreetingMessageOneQueues,
      "sendGreetingMessageOneQueues"
    );
  }
  if (Object.prototype.hasOwnProperty.call(settings, "chatBotType")) {
    const chatBotTypeRaw = settings.chatBotType as unknown;
    const chatBotTypeStr =
      chatBotTypeRaw == null ? "" : String(chatBotTypeRaw).trim();
    if (!["text", "button", "list"].includes(chatBotTypeStr)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400);
    }
    patch.chatBotType = chatBotTypeStr;
  }
  if (Object.prototype.hasOwnProperty.call(settings, "userRating")) {
    const userRatingRaw = settings.userRating as unknown;
    const userRatingStr =
      userRatingRaw == null ? "" : String(userRatingRaw).trim();
    if (!AUTO_MESSAGE_VALUES.has(userRatingStr)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400);
    }
    patch.userRating = userRatingStr;
  }
  if (Object.prototype.hasOwnProperty.call(settings, "scheduleType")) {
    const scheduleTypeRaw = settings.scheduleType as unknown;
    const scheduleTypeStr =
      scheduleTypeRaw == null ? "" : String(scheduleTypeRaw).trim();
    if (!SCHEDULE_TYPE_VALUES.has(scheduleTypeStr)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400);
    }
    patch.scheduleType = scheduleTypeStr;
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }

  return patch;
}
