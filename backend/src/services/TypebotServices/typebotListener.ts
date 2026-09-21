import axios, { AxiosRequestConfig } from "axios";
// eslint-disable-next-line import/no-extraneous-dependencies
import { isNil } from "lodash";
import Ticket from "../../models/Ticket";
import QueueIntegrations from "../../models/QueueIntegrations";
import { logger } from "../../utils/logger";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { isWhatsAppDisableAllReadAndPresenceSideEffects } from "../../helpers/whatsappUnavailablePresence";
import { getTicketRemoteJid } from "../../helpers/GetTicketRemoteJid";
import { WhatsAppOutbound } from "../../modules/whatsapp/outbound/WhatsAppOutbound";
import { getWhatsAppOutboundForTicket } from "../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import type { NormalizedWhatsAppMessage } from "../../modules/whatsapp/inbound/NormalizedWhatsAppMessage";
import { typebotSleep } from "./typebotSleep";
import type { TypebotLegacyMediaCapability } from "./typebotLegacyMedia";
import { trySendTypebotRemoteMedia } from "./sendTypebotRemoteMedia";
import { persistWhatsAppOutboundMessage } from "../MessageServices/persistWhatsAppOutboundMessage";

/* Sequential Typebot replies must preserve send order. */
/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */

export type TypebotInbound = Pick<
  NormalizedWhatsAppMessage,
  "body" | "pushName" | "addressing" | "fromMe"
>;

export type TypebotListenerRequest = {
  ticket: Ticket;
  typebot: QueueIntegrations;
  inbound?: TypebotInbound;
  /**
   * @deprecated 12.3-F — mídia Typebot usa Buffer via sendTypebotRemoteMedia.
   * Mantido na assinatura para não quebrar callers 12.3-C.
   */
  media?: TypebotLegacyMediaCapability;
  /**
   * @deprecated 12.3-C — ignorado. Outbound via getWhatsAppOutboundForTicket.
   */
  wbot?: unknown;
  /**
   * @deprecated 12.3-C — usar inbound.body.
   */
  msg?: unknown;
};

export type TypebotListenerDeps = {
  getOutbound?: (ticket: Ticket) => Promise<WhatsAppOutbound>;
  sleep?: (ms: number) => Promise<void>;
  axiosRequest?: typeof axios.request;
  sendRemoteMedia?: typeof trySendTypebotRemoteMedia;
};

async function runTypebotTypingSimulation(
  outbound: WhatsAppOutbound,
  remoteJid: string,
  typebotDelayMessage: number,
  label: string,
  sleep: (ms: number) => Promise<void>
): Promise<void> {
  if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
    logger.info(
      `[WhatsAppPresence] suppressed context=${label} reason=WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE_SIDE_EFFECTS`
    );
    return;
  }
  await outbound.sendPresence({
    jid: remoteJid,
    presence: "composing",
    subscribe: true
  });
  await sleep(typebotDelayMessage);
  await outbound.sendPresence({ jid: remoteJid, presence: "paused" });
}

async function sendTypebotTextAndPersist(input: {
  outbound: WhatsAppOutbound;
  ticket: Ticket;
  jid: string;
  text: string;
}): Promise<void> {
  const sent = await input.outbound.sendText({
    jid: input.jid,
    text: input.text
  });
  await persistWhatsAppOutboundMessage({
    ticket: input.ticket,
    body: input.text,
    sent
  });
}

function hasTypebotSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === "string" && sessionId.trim() !== "";
}

/**
 * Sessão Typebot é específica do motor; chatbot/useIntegration/integrationId
 * passam por UpdateTicketService para persistir lifecycle AUTO e emitir socket.
 */
async function persistTypebotSessionStart(
  ticket: Ticket,
  typebot: QueueIntegrations,
  sessionId: string
): Promise<void> {
  await ticket.update({
    typebotSessionId: sessionId,
    typebotStatus: true
  });
  await UpdateTicketService({
    ticketData: {
      chatbot: true,
      useIntegration: true,
      integrationId: typebot.id
    },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
  await ticket.reload();
}

async function persistTypebotStopped(ticket: Ticket): Promise<void> {
  await ticket.update({
    typebotSessionId: null,
    typebotStatus: false
  });
  await UpdateTicketService({
    ticketData: {
      chatbot: false,
      useIntegration: false,
      integrationId: null
    },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
}

type TypebotInternalCommand =
  | { kind: "not_command" }
  | { kind: "invalid"; reason: "json_parse" | "unsupported_command" }
  | { kind: "stopBot" }
  | { kind: "queue"; queueId: number }
  | { kind: "queue_user"; queueId: number; userId: number };

type TypebotCommandJson = {
  stopBot?: unknown;
  queueId?: number;
  userId?: number;
};

/**
 * Caracteres de formato que o Typebot/Slate podem colar nas bordas do JSON.
 * U+00A0 (NBSP) não entra: String.trim() já o remove nas bordas.
 * U+FEFF também é WhiteSpace do trim, mas permanece no set para o caso em que
 * fica escondido atrás de U+200B (trim não atravessa ZWSP).
 * Remoção SOMENTE nas bordas externas — interior de strings JSON é preservado.
 */
const TYPEBOT_INTERNAL_COMMAND_BOUNDARY_FORMAT_CODES = new Set([
  0x200b, // ZERO WIDTH SPACE
  0xfeff // BYTE ORDER MARK / ZERO WIDTH NO-BREAK SPACE
]);

function isTypebotCommandBoundaryFormatChar(ch: number): boolean {
  return TYPEBOT_INTERNAL_COMMAND_BOUNDARY_FORMAT_CODES.has(ch);
}

/** Bordas de formato do payload JSON de comando interno Typebot. */
export function normalizeTypebotInternalCommandJsonText(
  jsonText: string
): string {
  let payload = String(jsonText || "");
  let previous = "";
  while (payload !== previous) {
    previous = payload;
    const trimmed = payload.trim();
    let start = 0;
    let end = trimmed.length;
    while (
      start < end &&
      isTypebotCommandBoundaryFormatChar(trimmed.charCodeAt(start))
    ) {
      start += 1;
    }
    while (
      end > start &&
      isTypebotCommandBoundaryFormatChar(trimmed.charCodeAt(end - 1))
    ) {
      end -= 1;
    }
    payload = trimmed.slice(start, end);
  }
  return payload;
}

export function parseTypebotInternalCommand(
  formattedText: string
): TypebotInternalCommand {
  const normalized = String(formattedText || "").trim();
  if (!normalized.startsWith("#")) {
    return { kind: "not_command" };
  }

  const jsonText = normalizeTypebotInternalCommandJsonText(normalized.slice(1));
  let parsed: TypebotCommandJson;
  try {
    parsed = JSON.parse(jsonText) as TypebotCommandJson;
  } catch {
    return { kind: "invalid", reason: "json_parse" };
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "invalid", reason: "unsupported_command" };
  }

  if (parsed.stopBot && isNil(parsed.userId) && isNil(parsed.queueId)) {
    return { kind: "stopBot" };
  }

  if (!isNil(parsed.queueId) && parsed.queueId > 0 && isNil(parsed.userId)) {
    return { kind: "queue", queueId: parsed.queueId };
  }

  if (
    !isNil(parsed.queueId) &&
    parsed.queueId > 0 &&
    !isNil(parsed.userId) &&
    parsed.userId > 0
  ) {
    return {
      kind: "queue_user",
      queueId: parsed.queueId,
      userId: parsed.userId
    };
  }

  return { kind: "invalid", reason: "unsupported_command" };
}

function formatTypebotRichText(message: {
  content?: { richText?: unknown[] };
}): { formattedText: string; linkPreview: boolean } {
  let formattedText = "";
  let linkPreview = false;
  const richText = message.content?.richText;
  if (!Array.isArray(richText)) {
    return { formattedText, linkPreview };
  }

  for (const block of richText as Array<{ children?: unknown[] }>) {
    if (!Array.isArray(block.children)) {
      formattedText += "\n";
      continue;
    }
    for (const element of block.children as Array<Record<string, unknown>>) {
      let text = "";

      if (element.text) {
        text = String(element.text);
      }
      if (element.type && element.children) {
        for (const subelement of element.children as Array<
          Record<string, unknown>
        >) {
          let nested = "";

          if (subelement.text) {
            nested = String(subelement.text);
          }

          if (subelement.type && subelement.children) {
            for (const subelement2 of subelement.children as Array<
              Record<string, unknown>
            >) {
              let deep = "";

              if (subelement2.text) {
                deep = String(subelement2.text);
              }

              if (subelement2.bold) {
                deep = `*${deep}*`;
              }
              if (subelement2.italic) {
                deep = `_${deep}_`;
              }
              if (subelement2.underline) {
                deep = `~${deep}~`;
              }
              if (subelement2.url) {
                const kids = subelement2.children as Array<{ text?: string }>;
                const linkText = kids?.[0]?.text;
                deep = `[${linkText}](${subelement2.url})`;
                linkPreview = true;
              }
              formattedText += deep;
            }
          }
          if (subelement.bold) {
            nested = `*${nested}*`;
          }
          if (subelement.italic) {
            nested = `_${nested}_`;
          }
          if (subelement.underline) {
            nested = `~${nested}~`;
          }
          if (subelement.url) {
            const kids = subelement.children as Array<{ text?: string }>;
            const linkText = kids?.[0]?.text;
            nested = `[${linkText}](${subelement.url})`;
            linkPreview = true;
          }
          formattedText += nested;
        }
      }

      if (element.bold) {
        text = `*${text}*`;
      }
      if (element.italic) {
        text = `_${text}_`;
      }
      if (element.underline) {
        text = `~${text}~`;
      }

      if (element.url) {
        const kids = element.children as Array<{ text?: string }>;
        const linkText = kids?.[0]?.text;
        text = `[${linkText}](${element.url})`;
        linkPreview = true;
      }

      formattedText += text;
    }
    formattedText += "\n";
  }
  formattedText = formattedText.replace("**", "").replace(/\n$/, "");
  return { formattedText, linkPreview };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

const TYPEBOT_JSON_PARSE_OBS_MARKER =
  "[Typebot][OBS] internal command json parse diagnostics";
const TYPEBOT_OBS_CODE_POINT_CAP = 32;
const TYPEBOT_OBS_SPECIAL_CAP = 64;

type TypebotObsSpecialKind =
  | "control"
  | "format"
  | "line_break"
  | "tab"
  | "non_json_space";

type TypebotObsSpecialCodePoint = {
  index: number;
  codePoint: string;
  kind: TypebotObsSpecialKind;
};

function formatTypebotObsCodePoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

function classifyTypebotObsCodePoint(cp: number): TypebotObsSpecialKind | null {
  if (cp === 0x0009) return "tab";
  if (cp === 0x000a || cp === 0x000d || cp === 0x2028 || cp === 0x2029) {
    return "line_break";
  }
  if (cp <= 0x001f || (cp >= 0x007f && cp <= 0x009f)) return "control";
  if (
    cp === 0x00ad ||
    cp === 0x061c ||
    cp === 0x180e ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x2064) ||
    (cp >= 0x2066 && cp <= 0x206f) ||
    cp === 0xfeff ||
    (cp >= 0xfff9 && cp <= 0xfffb)
  ) {
    return "format";
  }
  if (
    cp === 0x00a0 ||
    cp === 0x1680 ||
    (cp >= 0x2000 && cp <= 0x200a) ||
    cp === 0x202f ||
    cp === 0x205f ||
    cp === 0x3000
  ) {
    return "non_json_space";
  }
  return null;
}

function iterateTypebotObsCodePoints(
  text: string
): Array<{ index: number; codePoint: number }> {
  const out: Array<{ index: number; codePoint: number }> = [];
  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i);
    if (codePoint == null) break;
    out.push({ index: i, codePoint });
    i += codePoint > 0xffff ? 2 : 1;
  }
  return out;
}

function mapTypebotObsCodePoints(
  text: string,
  cap = TYPEBOT_OBS_CODE_POINT_CAP
): string[] {
  return iterateTypebotObsCodePoints(text)
    .slice(0, cap)
    .map(item => formatTypebotObsCodePoint(item.codePoint));
}

function collectTypebotObsSpecialCodePoints(
  text: string
): TypebotObsSpecialCodePoint[] {
  const out: TypebotObsSpecialCodePoint[] = [];
  for (const item of iterateTypebotObsCodePoints(text)) {
    const kind = classifyTypebotObsCodePoint(item.codePoint);
    if (!kind) continue;
    out.push({
      index: item.index,
      codePoint: formatTypebotObsCodePoint(item.codePoint),
      kind
    });
    if (out.length >= TYPEBOT_OBS_SPECIAL_CAP) break;
  }
  return out;
}

function summarizeTypebotObsChildText(child: unknown): {
  textLength: number;
  isEmpty: boolean;
  firstCodePoint: string | null;
  lastCodePoint: string | null;
  hasFormatOrControl: boolean;
  nestedChildCount: number;
  specialCodePoints: TypebotObsSpecialCodePoint[];
} {
  const rec = isPlainRecord(child) ? child : null;
  const text = typeof rec?.text === "string" ? rec.text : "";
  const cps = iterateTypebotObsCodePoints(text);
  const specialCodePoints = collectTypebotObsSpecialCodePoints(text);
  return {
    textLength: text.length,
    isEmpty: text.length === 0,
    firstCodePoint:
      cps.length > 0 ? formatTypebotObsCodePoint(cps[0].codePoint) : null,
    lastCodePoint:
      cps.length > 0
        ? formatTypebotObsCodePoint(cps[cps.length - 1].codePoint)
        : null,
    hasFormatOrControl: specialCodePoints.length > 0,
    nestedChildCount: Array.isArray(rec?.children) ? rec.children.length : 0,
    specialCodePoints
  };
}

function collectTypebotObsTextNodes(
  node: unknown,
  depth: number,
  acc: Array<{
    depth: number;
    textLength: number;
    isEmpty: boolean;
    firstCodePoint: string | null;
    lastCodePoint: string | null;
    hasFormatOrControl: boolean;
    specialCodePoints: TypebotObsSpecialCodePoint[];
  }>
): void {
  if (!isPlainRecord(node)) return;
  if (typeof node.text === "string") {
    const summary = summarizeTypebotObsChildText(node);
    acc.push({
      depth,
      textLength: summary.textLength,
      isEmpty: summary.isEmpty,
      firstCodePoint: summary.firstCodePoint,
      lastCodePoint: summary.lastCodePoint,
      hasFormatOrControl: summary.hasFormatOrControl,
      specialCodePoints: summary.specialCodePoints
    });
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectTypebotObsTextNodes(child, depth + 1, acc);
    }
  }
}

/** TEMPORÁRIO FIX11-OBS — metadados Unicode do json_parse, sem conteúdo. */
export function summarizeTypebotInternalCommandJsonParseDiagnostics(input: {
  ticketId: number;
  integrationId: number | null;
  formattedText: string;
  message?: unknown;
}): {
  ticketId: number;
  integrationId: number | null;
  payloadLength: number;
  firstCodePoint: string | null;
  lastCodePoint: string | null;
  firstBraceIndex: number | null;
  lastBraceIndex: number | null;
  prefixLength: number;
  suffixLength: number;
  prefixCodePoints: string[];
  suffixCodePoints: string[];
  controlCodePoints: string[];
  formatCodePoints: string[];
  lineBreakCount: number;
  tabCount: number;
  specialCodePoints: TypebotObsSpecialCodePoint[];
  richText: {
    blockCount: number;
    totalChildren: number;
    blocks: Array<{
      childrenCount: number;
      children: ReturnType<typeof summarizeTypebotObsChildText>[];
    }>;
    textNodeCount: number;
    textNodes: Array<{
      depth: number;
      textLength: number;
      isEmpty: boolean;
      firstCodePoint: string | null;
      lastCodePoint: string | null;
      hasFormatOrControl: boolean;
      specialCodePoints: TypebotObsSpecialCodePoint[];
    }>;
  };
} {
  const normalized = String(input.formattedText || "").trim();
  const jsonText = normalized.startsWith("#")
    ? normalizeTypebotInternalCommandJsonText(normalized.slice(1))
    : "";
  const cps = iterateTypebotObsCodePoints(jsonText);
  const specialCodePoints = collectTypebotObsSpecialCodePoints(jsonText);
  const firstBraceIndex = jsonText.indexOf("{");
  const lastBraceIndex = jsonText.lastIndexOf("}");
  const prefix =
    firstBraceIndex >= 0 ? jsonText.slice(0, firstBraceIndex) : jsonText;
  const suffix =
    lastBraceIndex >= 0 && lastBraceIndex >= firstBraceIndex
      ? jsonText.slice(lastBraceIndex + 1)
      : "";

  const rec = isPlainRecord(input.message) ? input.message : null;
  const content = isPlainRecord(rec?.content) ? rec.content : null;
  const richText = Array.isArray(content?.richText) ? content.richText : [];
  const blocks = richText.map(block => {
    const children =
      isPlainRecord(block) && Array.isArray(block.children)
        ? block.children
        : [];
    return {
      childrenCount: children.length,
      children: children.map(child => summarizeTypebotObsChildText(child))
    };
  });
  const textNodes: Array<{
    depth: number;
    textLength: number;
    isEmpty: boolean;
    firstCodePoint: string | null;
    lastCodePoint: string | null;
    hasFormatOrControl: boolean;
    specialCodePoints: TypebotObsSpecialCodePoint[];
  }> = [];
  for (const block of richText) {
    collectTypebotObsTextNodes(block, 0, textNodes);
  }

  return {
    ticketId: input.ticketId,
    integrationId: input.integrationId,
    payloadLength: jsonText.length,
    firstCodePoint:
      cps.length > 0 ? formatTypebotObsCodePoint(cps[0].codePoint) : null,
    lastCodePoint:
      cps.length > 0
        ? formatTypebotObsCodePoint(cps[cps.length - 1].codePoint)
        : null,
    firstBraceIndex: firstBraceIndex >= 0 ? firstBraceIndex : null,
    lastBraceIndex: lastBraceIndex >= 0 ? lastBraceIndex : null,
    prefixLength: prefix.length,
    suffixLength: suffix.length,
    prefixCodePoints: mapTypebotObsCodePoints(prefix),
    suffixCodePoints: mapTypebotObsCodePoints(suffix),
    controlCodePoints: specialCodePoints
      .filter(item => item.kind === "control")
      .map(item => item.codePoint),
    formatCodePoints: specialCodePoints
      .filter(item => item.kind === "format")
      .map(item => item.codePoint),
    lineBreakCount: specialCodePoints.filter(item => item.kind === "line_break")
      .length,
    tabCount: specialCodePoints.filter(item => item.kind === "tab").length,
    specialCodePoints,
    richText: {
      blockCount: richText.length,
      totalChildren: blocks.reduce((n, block) => n + block.childrenCount, 0),
      blocks,
      textNodeCount: textNodes.length,
      textNodes
    }
  };
}

function summarizeTypebotContinueChatMessage(
  message: unknown,
  index: number
): {
  index: number;
  type: string | null;
  hasRichText: boolean;
  richTextBlockCount: number;
  hasMarkdown: boolean;
  startsWithHash: boolean;
} {
  const rec = isPlainRecord(message) ? message : null;
  const type = typeof rec?.type === "string" ? rec.type : null;
  const content = isPlainRecord(rec?.content) ? rec.content : null;
  const richText = Array.isArray(content?.richText) ? content.richText : null;
  const hasMarkdown =
    content != null &&
    (content.type === "markdown" || typeof content.markdown === "string");

  let startsWithHash = false;
  if (type === "text") {
    const { formattedText } = formatTypebotRichText(
      rec as { content?: { richText?: unknown[] } }
    );
    startsWithHash = formattedText.trim().startsWith("#");
  }

  return {
    index,
    type,
    hasRichText: richText != null,
    richTextBlockCount: richText ? richText.length : 0,
    hasMarkdown,
    startsWithHash
  };
}

/** TEMPORÁRIO homologação FIX9 — só metadados estruturais do continueChat. */
export function summarizeTypebotContinueChatStructure(input: {
  ticketId: number;
  companyId: number;
  integrationId: number | null;
  messages: unknown;
  input: unknown;
  clientSideActions: unknown;
}): {
  ticketId: number;
  companyId: number;
  integrationId: number | null;
  messagesCount: number;
  messages: Array<{
    index: number;
    type: string | null;
    hasRichText: boolean;
    richTextBlockCount: number;
    hasMarkdown: boolean;
    startsWithHash: boolean;
  }>;
  hasInput: boolean;
  inputType: string | null;
  clientSideActionsCount: number;
  clientSideActionTypes: string[];
} {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const actions = Array.isArray(input.clientSideActions)
    ? input.clientSideActions
    : [];
  const inputRec = isPlainRecord(input.input) ? input.input : null;

  return {
    ticketId: input.ticketId,
    companyId: input.companyId,
    integrationId: input.integrationId,
    messagesCount: messages.length,
    messages: messages.map((message, index) =>
      summarizeTypebotContinueChatMessage(message, index)
    ),
    hasInput: inputRec != null,
    inputType: typeof inputRec?.type === "string" ? inputRec.type : null,
    clientSideActionsCount: actions.length,
    clientSideActionTypes: actions.map(action =>
      isPlainRecord(action) && typeof action.type === "string"
        ? action.type
        : "unknown"
    )
  };
}

export async function resolveTypebotDestinationJid(
  ticket: Ticket,
  inbound?: TypebotInbound
): Promise<string | null> {
  const fromInbound = inbound?.addressing?.remoteJid;
  if (
    typeof fromInbound === "string" &&
    fromInbound.includes("@") &&
    fromInbound !== "status@broadcast"
  ) {
    return fromInbound;
  }

  const fromTicket = await getTicketRemoteJid(ticket);
  if (fromTicket && fromTicket !== "status@broadcast") {
    return fromTicket;
  }

  if (ticket.isGroup) {
    return null;
  }

  const destNumber = String(ticket.contact?.number || "").replace(/\D/g, "");
  if (!destNumber) {
    return null;
  }
  return `${destNumber}@s.whatsapp.net`;
}

const typebotListener = async (
  { ticket, typebot, inbound }: TypebotListenerRequest,
  deps?: TypebotListenerDeps
): Promise<void> => {
  const getOutbound = deps?.getOutbound || getWhatsAppOutboundForTicket;
  const sleep = deps?.sleep || typebotSleep;
  const axiosRequest = deps?.axiosRequest || axios.request.bind(axios);
  const sendRemoteMedia = deps?.sendRemoteMedia || trySendTypebotRemoteMedia;

  const remoteJid = await resolveTypebotDestinationJid(ticket, inbound);
  if (!remoteJid || remoteJid === "status@broadcast") {
    logger.info(
      { ticketId: ticket.id },
      "[Typebot] skipped: unresolvable destination"
    );
    return;
  }

  const {
    urlN8N: url,
    typebotExpires,
    typebotKeywordFinish,
    typebotKeywordRestart,
    typebotUnknownMessage,
    typebotDelayMessage,
    typebotRestartMessage
  } = typebot;

  const outbound = await getOutbound(ticket);
  const number = remoteJid.replace(/\D/g, "");
  const body = inbound?.body != null ? inbound.body : null;

  async function createSession(
    typebotCfg: typeof typebot,
    numberValue: string
  ) {
    try {
      const reqData = JSON.stringify({
        isStreamEnabled: true,
        message: "string",
        resultId: "string",
        isOnlyRegistering: false,
        prefilledVariables: {
          number: numberValue,
          pushName: inbound?.pushName || ""
        }
      });

      const config: AxiosRequestConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${url}/api/v1/typebots/${typebotCfg.typebotSlug}/startChat`,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        data: reqData
      };

      const request = await axiosRequest(config);
      return request.data;
    } catch (err) {
      logger.info("Erro ao criar sessão do typebot: ", err);
      throw err;
    }
  }

  let sessionId: string;
  let dataStart:
    | { sessionId?: string; messages?: unknown[]; input?: unknown }
    | undefined;
  let status = false;
  try {
    const dataLimite = new Date();
    dataLimite.setMinutes(dataLimite.getMinutes() - Number(typebotExpires));

    if (typebotExpires > 0 && ticket.updatedAt < dataLimite) {
      await ticket.update({
        typebotSessionId: null
      });

      await ticket.reload();
    }

    if (isNil(ticket.typebotSessionId)) {
      dataStart = await createSession(typebot, number);
      const startedSessionId = dataStart?.sessionId;
      if (!hasTypebotSessionId(startedSessionId)) {
        throw new Error("Typebot startChat returned empty sessionId");
      }
      sessionId = startedSessionId;
      status = true;
      await persistTypebotSessionStart(ticket, typebot, sessionId);
    } else {
      sessionId = ticket.typebotSessionId;
      status = ticket.typebotStatus;
    }

    if (!status) return;

    if (body !== typebotKeywordFinish && body !== typebotKeywordRestart) {
      let requestContinue: {
        data?: {
          messages?: unknown[];
          input?: unknown;
          clientSideActions?: unknown;
        };
      };
      let messages: Array<Record<string, unknown>>;
      let input: { type?: string; items?: Array<{ content?: string }> };
      let continueChatData:
        | {
            messages?: unknown[];
            input?: unknown;
            clientSideActions?: unknown;
          }
        | undefined;
      if (dataStart?.messages?.length === 0 || dataStart === undefined) {
        const reqData = JSON.stringify({
          message: body
        });

        const config: AxiosRequestConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: `${url}/api/v1/sessions/${sessionId}/continueChat`,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          data: reqData
        };
        requestContinue = await axiosRequest(config);
        continueChatData = requestContinue.data;
        messages = (continueChatData?.messages || []) as Array<
          Record<string, unknown>
        >;
        input = continueChatData?.input as typeof input;
      } else {
        messages = (dataStart?.messages || []) as Array<
          Record<string, unknown>
        >;
        input = dataStart?.input as typeof input;
      }

      if (continueChatData !== undefined) {
        logger.info(
          summarizeTypebotContinueChatStructure({
            ticketId: ticket.id,
            companyId: ticket.companyId,
            integrationId: ticket.integrationId ?? typebot.id,
            messages,
            input,
            clientSideActions: continueChatData.clientSideActions
          }),
          "[Typebot][OBS] continueChat response structure"
        );
      }

      if (messages?.length === 0) {
        await sendTypebotTextAndPersist({
          outbound,
          ticket,
          jid: remoteJid,
          text: typebotUnknownMessage
        });
      } else {
        for (const message of messages) {
          if (message.type === "text") {
            let { formattedText } = formatTypebotRichText(
              message as { content?: { richText?: unknown[] } }
            );

            if (formattedText === "Invalid message. Please, try again.") {
              formattedText = typebotUnknownMessage;
            }

            const internalCommand = parseTypebotInternalCommand(formattedText);
            if (internalCommand.kind !== "not_command") {
              if (internalCommand.kind === "stopBot") {
                await persistTypebotStopped(ticket);
                return;
              }
              if (internalCommand.kind === "queue") {
                await UpdateTicketService({
                  ticketData: {
                    queueId: internalCommand.queueId,
                    chatbot: false,
                    useIntegration: false,
                    integrationId: null
                  },
                  ticketId: ticket.id,
                  companyId: ticket.companyId
                });
                return;
              }
              if (internalCommand.kind === "queue_user") {
                await UpdateTicketService({
                  ticketData: {
                    queueId: internalCommand.queueId,
                    userId: internalCommand.userId,
                    chatbot: false,
                    useIntegration: false,
                    integrationId: null
                  },
                  ticketId: ticket.id,
                  companyId: ticket.companyId
                });
                return;
              }

              logger.info(
                {
                  ticketId: ticket.id,
                  integrationId: ticket.integrationId ?? typebot.id,
                  reason: internalCommand.reason
                },
                "[Typebot] internal command ignored"
              );
              if (internalCommand.reason === "json_parse") {
                logger.info(
                  summarizeTypebotInternalCommandJsonParseDiagnostics({
                    ticketId: ticket.id,
                    integrationId: ticket.integrationId ?? typebot.id,
                    formattedText,
                    message
                  }),
                  TYPEBOT_JSON_PARSE_OBS_MARKER
                );
              }
              continue;
            }

            await runTypebotTypingSimulation(
              outbound,
              remoteJid,
              typebotDelayMessage,
              "typebot:text_reply",
              sleep
            );

            await sendTypebotTextAndPersist({
              outbound,
              ticket,
              jid: remoteJid,
              text: formattedText
            });
          }

          if (message.type === "audio") {
            const urlMedia = (message.content as { url?: string } | undefined)
              ?.url;
            if (!urlMedia) {
              logger.info(
                { ticketId: ticket.id, kind: "audio" },
                "[Typebot] audio skipped: missing url"
              );
            } else {
              await runTypebotTypingSimulation(
                outbound,
                remoteJid,
                typebotDelayMessage,
                "typebot:audio",
                sleep
              );
              await sendRemoteMedia({
                outbound,
                jid: remoteJid,
                kind: "audio",
                url: urlMedia,
                ticketId: ticket.id,
                ticket
              });
            }
          }

          if (message.type === "image") {
            const imageContent = message.content as
              | { url?: string; caption?: string }
              | undefined;
            const urlMedia = imageContent?.url;
            if (!urlMedia) {
              logger.info(
                { ticketId: ticket.id, kind: "image" },
                "[Typebot] image skipped: missing url"
              );
            } else {
              await runTypebotTypingSimulation(
                outbound,
                remoteJid,
                typebotDelayMessage,
                "typebot:image",
                sleep
              );
              await sendRemoteMedia({
                outbound,
                jid: remoteJid,
                kind: "image",
                url: urlMedia,
                caption: imageContent?.caption || null,
                ticketId: ticket.id,
                ticket
              });
            }
          }
        }
        if (input) {
          if (input.type === "choice input") {
            let formattedText = "";
            const { items } = input;
            for (const item of items) {
              formattedText += `▶️ ${item.content}\n`;
            }
            formattedText = formattedText.replace(/\n$/, "");
            await runTypebotTypingSimulation(
              outbound,
              remoteJid,
              typebotDelayMessage,
              "typebot:choice_input",
              sleep
            );
            await sendTypebotTextAndPersist({
              outbound,
              ticket,
              jid: remoteJid,
              text: formattedText
            });
          }
        }
      }
    }
    if (body === typebotKeywordRestart) {
      await ticket.update({
        typebotSessionId: null
      });

      await ticket.reload();

      await UpdateTicketService({
        ticketData: {
          chatbot: true
        },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });

      await sendTypebotTextAndPersist({
        outbound,
        ticket,
        jid: remoteJid,
        text: typebotRestartMessage
      });
    }
    if (body === typebotKeywordFinish) {
      await UpdateTicketService({
        ticketData: {
          status: "closed",
          chatbot: false,
          useIntegration: false,
          integrationId: null
        },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });
    }
  } catch (error) {
    logger.info("Error on typebotListener: ", error);
    await ticket.update({
      typebotSessionId: null
    });
    throw error;
  }
};

export default typebotListener;
