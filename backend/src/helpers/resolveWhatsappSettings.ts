import Whatsapp from "../models/Whatsapp";
import {
  AutoMessageSettingValue,
  CallHandlingMode,
  ChatBotTypeValue,
  GroupMessagesMode,
  ScheduleTypeValue,
  WhatsappAutoMessagesEffective,
  WhatsappBehaviorEffective,
  WHATSAPP_BEHAVIOR_ATTRIBUTES,
  getGlobalAutoMessagesFallback,
  getGlobalBehaviorFallback,
  getGlobalChatBotType,
  getGlobalScheduleType,
  getGlobalUserRating,
  pickAutoMessageColumn,
  pickChatBotTypeColumn,
  pickScheduleTypeColumn
} from "./whatsappBehaviorSettings";
import { logBehaviorResolution } from "./whatsappBehaviorDebug";

export type WhatsappBehaviorColumnValues = {
  callHandlingMode: string | null;
  sendMessageOnCallReject: boolean | null;
  callRejectMessage: string | null;
  groupMessagesMode: string | null;
  sendGreetingAccepted: string | null;
  sendMsgTransfTicket: string | null;
  sendGreetingMessageOneQueues: string | null;
  chatBotType: string | null;
  userRating: string | null;
  scheduleType: string | null;
};

export type WhatsappSettingsResolved = {
  companyId: number;
  whatsappId: number | null;
  callsGroups: WhatsappBehaviorEffective;
  autoMessages: WhatsappAutoMessagesEffective;
  chatBotType: ChatBotTypeValue;
  userRating: AutoMessageSettingValue;
  scheduleType: ScheduleTypeValue;
  usesPerConnectionConfig: boolean;
  usesPerConnectionAutoMessages: boolean;
  usesPerConnectionChatBotType: boolean;
  usesPerConnectionUserRating: boolean;
  usesPerConnectionScheduleType: boolean;
  columnValues: WhatsappBehaviorColumnValues | null;
};

export type GlobalBehaviorBundle = {
  callsGroups: WhatsappBehaviorEffective;
  autoMessages: WhatsappAutoMessagesEffective;
  chatBotType: ChatBotTypeValue;
  userRating: AutoMessageSettingValue;
  scheduleType: ScheduleTypeValue;
};

function columnValuesFromWhatsapp(
  wa: Whatsapp | null
): WhatsappBehaviorColumnValues | null {
  if (!wa) {
    return null;
  }
  return {
    callHandlingMode: wa.callHandlingMode ?? null,
    sendMessageOnCallReject: wa.sendMessageOnCallReject ?? null,
    callRejectMessage: wa.callRejectMessage ?? null,
    groupMessagesMode: wa.groupMessagesMode ?? null,
    sendGreetingAccepted: (wa as any).sendGreetingAccepted ?? null,
    sendMsgTransfTicket: (wa as any).sendMsgTransfTicket ?? null,
    sendGreetingMessageOneQueues:
      (wa as any).sendGreetingMessageOneQueues ?? null,
    chatBotType: (wa as any).chatBotType ?? null,
    userRating: (wa as any).userRating ?? null,
    scheduleType: (wa as any).scheduleType ?? null
  };
}

function resolveCallsGroupsFromRow(
  wa: Whatsapp | null,
  global: WhatsappBehaviorEffective
): {
  effective: WhatsappBehaviorEffective;
  usesPerConnectionConfig: boolean;
} {
  if (!wa) {
    return { effective: global, usesPerConnectionConfig: false };
  }

  let usesGlobalFallback = false;
  const hasOwnCallsGroups =
    wa.callHandlingMode != null ||
    wa.sendMessageOnCallReject != null ||
    (wa.callRejectMessage != null && String(wa.callRejectMessage).trim() !== "") ||
    wa.groupMessagesMode != null;

  let callHandlingMode: CallHandlingMode = global.callHandlingMode;
  if (wa.callHandlingMode === "accept" || wa.callHandlingMode === "reject") {
    callHandlingMode = wa.callHandlingMode;
  } else {
    usesGlobalFallback = true;
  }

  let sendMessageOnCallReject = global.sendMessageOnCallReject;
  if (wa.sendMessageOnCallReject != null) {
    sendMessageOnCallReject = Boolean(wa.sendMessageOnCallReject);
  } else {
    usesGlobalFallback = true;
  }

  let callRejectMessage = global.callRejectMessage;
  if (wa.callRejectMessage != null && String(wa.callRejectMessage).trim() !== "") {
    callRejectMessage = String(wa.callRejectMessage);
  } else if (wa.callRejectMessage == null) {
    usesGlobalFallback = true;
  }

  let groupMessagesMode: GroupMessagesMode = global.groupMessagesMode;
  if (wa.groupMessagesMode === "ignore" || wa.groupMessagesMode === "receive") {
    groupMessagesMode = wa.groupMessagesMode;
  } else {
    usesGlobalFallback = true;
  }

  return {
    effective: {
      callHandlingMode,
      sendMessageOnCallReject,
      callRejectMessage,
      groupMessagesMode,
      usesGlobalFallback
    },
    usesPerConnectionConfig: hasOwnCallsGroups
  };
}

function resolveAutoMessagesFromRow(
  wa: Whatsapp | null,
  global: WhatsappAutoMessagesEffective
): {
  effective: WhatsappAutoMessagesEffective;
  usesPerConnectionAutoMessages: boolean;
} {
  if (!wa) {
    return { effective: global, usesPerConnectionAutoMessages: false };
  }

  const hasOwnAutoMessages =
    (wa as any).sendGreetingAccepted != null ||
    (wa as any).sendMsgTransfTicket != null ||
    (wa as any).sendGreetingMessageOneQueues != null;

  const greeting = pickAutoMessageColumn(
    (wa as any).sendGreetingAccepted,
    global.sendGreetingAccepted
  );
  const transfer = pickAutoMessageColumn(
    (wa as any).sendMsgTransfTicket,
    global.sendMsgTransfTicket
  );
  const oneQueue = pickAutoMessageColumn(
    (wa as any).sendGreetingMessageOneQueues,
    global.sendGreetingMessageOneQueues
  );

  return {
    effective: {
      sendGreetingAccepted: greeting.value,
      sendMsgTransfTicket: transfer.value,
      sendGreetingMessageOneQueues: oneQueue.value,
      usesGlobalFallback:
        greeting.inherited || transfer.inherited || oneQueue.inherited
    },
    usesPerConnectionAutoMessages: hasOwnAutoMessages
  };
}

export async function loadGlobalBehaviorBundle(
  companyId: number
): Promise<GlobalBehaviorBundle> {
  const [callsGroups, autoMessages, chatBotType, userRating, scheduleType] =
    await Promise.all([
      getGlobalBehaviorFallback(companyId),
      getGlobalAutoMessagesFallback(companyId),
      getGlobalChatBotType(companyId),
      getGlobalUserRating(companyId),
      getGlobalScheduleType(companyId)
    ]);

  return {
    callsGroups,
    autoMessages,
    chatBotType,
    userRating,
    scheduleType
  };
}

export function resolveWhatsappSettingsFromRow(
  companyId: number,
  whatsappId: number | null,
  wa: Whatsapp | null,
  global: GlobalBehaviorBundle,
  context?: string
): WhatsappSettingsResolved {
  const calls = resolveCallsGroupsFromRow(wa, global.callsGroups);
  const auto = resolveAutoMessagesFromRow(wa, global.autoMessages);

  const chatBotTypeResolved = pickChatBotTypeColumn(
    wa ? (wa as any).chatBotType : null,
    global.chatBotType
  );
  const userRatingResolved = pickAutoMessageColumn(
    wa ? (wa as any).userRating : null,
    global.userRating
  );
  const scheduleTypeResolved = pickScheduleTypeColumn(
    wa ? (wa as any).scheduleType : null,
    global.scheduleType
  );

  const hasOwnChatBotType =
    wa != null &&
    ((wa as any).chatBotType === "text" ||
      (wa as any).chatBotType === "button" ||
      (wa as any).chatBotType === "list");

  const hasOwnUserRating =
    wa != null &&
    ((wa as any).userRating === "enabled" ||
      (wa as any).userRating === "disabled");

  const hasOwnScheduleType =
    wa != null &&
    ((wa as any).scheduleType === "disabled" ||
      (wa as any).scheduleType === "company" ||
      (wa as any).scheduleType === "queue");

  if (context) {
    logBehaviorResolution({
      companyId,
      whatsappId,
      context,
      field: "bundle",
      source: wa ? "connection" : "global"
    });
  }

  return {
    companyId,
    whatsappId,
    callsGroups: calls.effective,
    autoMessages: auto.effective,
    chatBotType: chatBotTypeResolved.value,
    userRating: userRatingResolved.value,
    scheduleType: scheduleTypeResolved.value,
    usesPerConnectionConfig: calls.usesPerConnectionConfig,
    usesPerConnectionAutoMessages: auto.usesPerConnectionAutoMessages,
    usesPerConnectionChatBotType: hasOwnChatBotType,
    usesPerConnectionUserRating: hasOwnUserRating,
    usesPerConnectionScheduleType: hasOwnScheduleType,
    columnValues: columnValuesFromWhatsapp(wa)
  };
}

export async function resolveWhatsappSettings(
  whatsappId: number | null | undefined,
  companyId: number,
  context?: string
): Promise<WhatsappSettingsResolved> {
  const global = await loadGlobalBehaviorBundle(companyId);
  const id = Number(whatsappId);
  if (!Number.isFinite(id) || id <= 0) {
    return resolveWhatsappSettingsFromRow(
      companyId,
      null,
      null,
      global,
      context
    );
  }

  const wa = await Whatsapp.findOne({
    where: { id, companyId },
    attributes: [
      "id",
      ...WHATSAPP_BEHAVIOR_ATTRIBUTES.filter((k) => k !== "id")
    ]
  });

  return resolveWhatsappSettingsFromRow(
    companyId,
    wa?.id ?? id,
    wa,
    global,
    context
  );
}
