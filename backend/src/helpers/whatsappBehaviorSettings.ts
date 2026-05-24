import Setting from "../models/Setting";
import Whatsapp from "../models/Whatsapp";
import Company from "../models/Company";
import type { WhatsappBehaviorColumnValues } from "./resolveWhatsappSettings";

export type CallHandlingMode = "accept" | "reject";
export type GroupMessagesMode = "ignore" | "receive";
export type AutoMessageSettingValue = "enabled" | "disabled";
export type ChatBotTypeValue = "text" | "button" | "list";
export type ScheduleTypeValue = "disabled" | "company" | "queue";

export type WhatsappAutoMessagesEffective = {
  sendGreetingAccepted: AutoMessageSettingValue;
  sendMsgTransfTicket: AutoMessageSettingValue;
  sendGreetingMessageOneQueues: AutoMessageSettingValue;
  usesGlobalFallback: boolean;
};

export type WhatsappBehaviorEffective = {
  callHandlingMode: CallHandlingMode;
  sendMessageOnCallReject: boolean;
  callRejectMessage: string;
  groupMessagesMode: GroupMessagesMode;
  usesGlobalFallback: boolean;
};

const DEFAULT_CALL_REJECT_MESSAGES: Record<string, string> = {
  pt: "*Mensagem automática*\n\nEste número não recebe chamadas. Envie uma mensagem de texto que responderemos por aqui.",
  en: "*Automatic message*\n\nThis number does not accept calls. Please send a text message and we will reply here.",
  es: "*Mensaje automático*\n\nEste número no recibe llamadas. Envíe un mensaje de texto y responderemos aquí."
};

const AUTO_MESSAGE_SETTING_KEYS = [
  "sendGreetingAccepted",
  "sendMsgTransfTicket",
  "sendGreetingMessageOneQueues"
] as const;

export const WHATSAPP_BEHAVIOR_ATTRIBUTES = [
  "id",
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
] as const;

function normalizeChatBotType(raw: unknown): ChatBotTypeValue {
  if (raw === "button" || raw === "list" || raw === "text") {
    return raw;
  }
  return "text";
}

export function pickChatBotTypeColumn(
  columnValue: string | null | undefined,
  globalValue: ChatBotTypeValue
): { value: ChatBotTypeValue; inherited: boolean } {
  if (
    columnValue === "text" ||
    columnValue === "button" ||
    columnValue === "list"
  ) {
    return { value: columnValue, inherited: false };
  }
  return { value: globalValue, inherited: true };
}

export async function getGlobalChatBotType(
  companyId: number
): Promise<ChatBotTypeValue> {
  const row = await Setting.findOne({
    where: { companyId, key: "chatBotType" }
  });
  return normalizeChatBotType(row?.value);
}

export async function getGlobalUserRating(
  companyId: number
): Promise<AutoMessageSettingValue> {
  const row = await Setting.findOne({
    where: { companyId, key: "userRating" }
  });
  return normalizeAutoMessageValue(row?.value);
}

function normalizeScheduleType(raw: unknown): ScheduleTypeValue {
  if (raw === "company" || raw === "queue") {
    return raw;
  }
  return "disabled";
}

export function pickScheduleTypeColumn(
  columnValue: string | null | undefined,
  globalValue: ScheduleTypeValue
): { value: ScheduleTypeValue; inherited: boolean } {
  if (
    columnValue === "disabled" ||
    columnValue === "company" ||
    columnValue === "queue"
  ) {
    return { value: columnValue, inherited: false };
  }
  return { value: globalValue, inherited: true };
}

export async function getGlobalScheduleType(
  companyId: number
): Promise<ScheduleTypeValue> {
  const row = await Setting.findOne({
    where: { companyId, key: "scheduleType" }
  });
  return normalizeScheduleType(row?.value);
}

export async function resolveScheduleType(
  whatsappId: number | null | undefined,
  companyId: number,
  context?: string
): Promise<ScheduleTypeValue> {
  const { resolveWhatsappSettings } = await import("./resolveWhatsappSettings");
  const resolved = await resolveWhatsappSettings(
    whatsappId,
    companyId,
    context ?? "resolveScheduleType"
  );
  return resolved.scheduleType;
}

export async function resolveUserRating(
  whatsappId: number | null | undefined,
  companyId: number,
  context?: string
): Promise<AutoMessageSettingValue> {
  const { resolveWhatsappSettings } = await import("./resolveWhatsappSettings");
  const resolved = await resolveWhatsappSettings(
    whatsappId,
    companyId,
    context ?? "resolveUserRating"
  );
  return resolved.userRating;
}

export async function resolveChatBotType(
  whatsappId: number | null | undefined,
  companyId: number,
  context?: string
): Promise<ChatBotTypeValue> {
  const { resolveWhatsappSettings } = await import("./resolveWhatsappSettings");
  const resolved = await resolveWhatsappSettings(
    whatsappId,
    companyId,
    context ?? "resolveChatBotType"
  );
  return resolved.chatBotType;
}

function normalizeAutoMessageValue(raw: unknown): AutoMessageSettingValue {
  return raw === "enabled" ? "enabled" : "disabled";
}

export function pickAutoMessageColumn(
  columnValue: string | null | undefined,
  globalValue: AutoMessageSettingValue
): { value: AutoMessageSettingValue; inherited: boolean } {
  if (columnValue === "enabled" || columnValue === "disabled") {
    return { value: columnValue, inherited: false };
  }
  return { value: globalValue, inherited: true };
}

export async function getGlobalAutoMessagesFallback(
  companyId: number
): Promise<WhatsappAutoMessagesEffective> {
  const rows = await Setting.findAll({
    where: {
      companyId,
      key: [...AUTO_MESSAGE_SETTING_KEYS]
    }
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    sendGreetingAccepted: normalizeAutoMessageValue(map.get("sendGreetingAccepted")),
    sendMsgTransfTicket: normalizeAutoMessageValue(map.get("sendMsgTransfTicket")),
    sendGreetingMessageOneQueues: normalizeAutoMessageValue(
      map.get("sendGreetingMessageOneQueues")
    ),
    usesGlobalFallback: true
  };
}

export async function resolveWhatsappAutoMessageSettings(
  whatsappId: number,
  companyId: number
): Promise<WhatsappAutoMessagesEffective> {
  const { resolveWhatsappSettings } = await import("./resolveWhatsappSettings");
  const resolved = await resolveWhatsappSettings(
    whatsappId,
    companyId,
    "resolveWhatsappAutoMessageSettings"
  );
  return resolved.autoMessages;
}

export async function getGlobalBehaviorFallback(
  companyId: number
): Promise<WhatsappBehaviorEffective> {
  const rows = await Setting.findAll({
    where: {
      companyId,
      key: ["call", "callRejectSendMessage", "callRejectMessage", "CheckMsgIsGroup"]
    }
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const callVal = map.get("call");
  const callHandlingMode: CallHandlingMode =
    callVal === "disabled" ? "reject" : "accept";

  const crs = map.get("callRejectSendMessage");
  const sendMessageOnCallReject = crs == null ? true : crs !== "disabled";

  const callRejectMessage =
    map.get("callRejectMessage") != null
      ? String(map.get("callRejectMessage"))
      : "";

  const groupVal = map.get("CheckMsgIsGroup");
  const groupMessagesMode: GroupMessagesMode =
    groupVal === "enabled" ? "ignore" : "receive";

  return {
    callHandlingMode,
    sendMessageOnCallReject,
    callRejectMessage,
    groupMessagesMode,
    usesGlobalFallback: true
  };
}

export async function resolveDefaultCallRejectText(
  companyId: number,
  customMessage?: string | null
): Promise<string> {
  const trimmed =
    customMessage != null ? String(customMessage).trim() : "";
  if (trimmed.length > 0) {
    return trimmed;
  }
  const company = await Company.findByPk(companyId, { attributes: ["language"] });
  const lang = company?.language || "pt";
  const key = ["pt", "en", "es"].includes(lang) ? lang : "pt";
  return DEFAULT_CALL_REJECT_MESSAGES[key];
}

export async function resolveWhatsappBehavior(
  whatsappId: number,
  companyId: number
): Promise<WhatsappBehaviorEffective> {
  const { resolveWhatsappSettings } = await import("./resolveWhatsappSettings");
  const resolved = await resolveWhatsappSettings(
    whatsappId,
    companyId,
    "resolveWhatsappBehavior"
  );
  return resolved.callsGroups;
}

export type WhatsappBehaviorRow = {
  id: number;
  name: string;
  status: string;
  callHandlingMode: CallHandlingMode;
  sendMessageOnCallReject: boolean;
  callRejectMessage: string;
  groupMessagesMode: GroupMessagesMode;
  sendGreetingAccepted: AutoMessageSettingValue;
  sendMsgTransfTicket: AutoMessageSettingValue;
  sendGreetingMessageOneQueues: AutoMessageSettingValue;
  chatBotType: ChatBotTypeValue;
  userRating: AutoMessageSettingValue;
  scheduleType: ScheduleTypeValue;
  usesPerConnectionConfig: boolean;
  usesPerConnectionAutoMessages: boolean;
  usesPerConnectionChatBotType: boolean;
  usesPerConnectionUserRating: boolean;
  usesPerConnectionScheduleType: boolean;
  columnValues: WhatsappBehaviorColumnValues;
};

export type {
  WhatsappBehaviorColumnValues,
  WhatsappSettingsResolved
} from "./resolveWhatsappSettings";
export {
  loadGlobalBehaviorBundle,
  resolveWhatsappSettings,
  resolveWhatsappSettingsFromRow
} from "./resolveWhatsappSettings";

export async function getWhatsappBehaviorRow(
  companyId: number,
  whatsappId: number
): Promise<WhatsappBehaviorRow | null> {
  const rows = await listWhatsappBehaviorRows(companyId);
  const id = Number(whatsappId);
  return rows.find((r) => r.id === id) ?? null;
}

export async function listWhatsappBehaviorRows(
  companyId: number
): Promise<WhatsappBehaviorRow[]> {
  const { loadGlobalBehaviorBundle, resolveWhatsappSettingsFromRow } =
    await import("./resolveWhatsappSettings");
  const global = await loadGlobalBehaviorBundle(companyId);
  const whatsapps = await Whatsapp.findAll({
    where: { companyId },
    attributes: [
      "id",
      "name",
      "status",
      ...WHATSAPP_BEHAVIOR_ATTRIBUTES.filter((k) => k !== "id")
    ],
    order: [["name", "ASC"]]
  });

  return whatsapps.map((wa) => {
    const resolved = resolveWhatsappSettingsFromRow(
      companyId,
      wa.id,
      wa,
      global,
      "listWhatsappBehaviorRows"
    );
    return {
      id: wa.id,
      name: wa.name,
      status: wa.status,
      callHandlingMode: resolved.callsGroups.callHandlingMode,
      sendMessageOnCallReject: resolved.callsGroups.sendMessageOnCallReject,
      callRejectMessage: resolved.callsGroups.callRejectMessage,
      groupMessagesMode: resolved.callsGroups.groupMessagesMode,
      sendGreetingAccepted: resolved.autoMessages.sendGreetingAccepted,
      sendMsgTransfTicket: resolved.autoMessages.sendMsgTransfTicket,
      sendGreetingMessageOneQueues:
        resolved.autoMessages.sendGreetingMessageOneQueues,
      chatBotType: resolved.chatBotType,
      userRating: resolved.userRating,
      scheduleType: resolved.scheduleType,
      usesPerConnectionConfig: resolved.usesPerConnectionConfig,
      usesPerConnectionAutoMessages: resolved.usesPerConnectionAutoMessages,
      usesPerConnectionChatBotType: resolved.usesPerConnectionChatBotType,
      usesPerConnectionUserRating: resolved.usesPerConnectionUserRating,
      usesPerConnectionScheduleType: resolved.usesPerConnectionScheduleType,
      columnValues: resolved.columnValues ?? {
        callHandlingMode: null,
        sendMessageOnCallReject: null,
        callRejectMessage: null,
        groupMessagesMode: null,
        sendGreetingAccepted: null,
        sendMsgTransfTicket: null,
        sendGreetingMessageOneQueues: null,
        chatBotType: null,
        userRating: null,
        scheduleType: null
      }
    };
  });
}
