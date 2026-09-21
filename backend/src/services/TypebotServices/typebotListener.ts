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

/**
 * Texto semântico do richText Typebot/Slate.
 * Não converte links em Markdown e não injeta sintaxe visual (* _ ~).
 * Usado só para o protocolo interno `#JSON`.
 */
export function extractTypebotRichTextPlain(message: {
  content?: { richText?: unknown[] };
}): string {
  const richText = message.content?.richText;
  if (!Array.isArray(richText)) {
    return "";
  }

  const walk = (node: unknown, acc: string[]): void => {
    if (node == null || typeof node !== "object" || Array.isArray(node)) {
      return;
    }
    const rec = node as Record<string, unknown>;
    if (typeof rec.text === "string") {
      acc.push(rec.text);
    }
    if (Array.isArray(rec.children)) {
      for (const child of rec.children) {
        walk(child, acc);
      }
    }
  };

  const blocks: string[] = [];
  for (const block of richText) {
    const parts: string[] = [];
    walk(block, parts);
    blocks.push(parts.join(""));
  }
  return blocks.join("\n").replace(/\n$/, "");
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
      let requestContinue: { data?: { messages?: unknown[]; input?: unknown } };
      let messages: Array<Record<string, unknown>>;
      let input: { type?: string; items?: Array<{ content?: string }> };
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
        messages = (requestContinue.data?.messages || []) as Array<
          Record<string, unknown>
        >;
        input = requestContinue.data?.input as typeof input;
      } else {
        messages = (dataStart?.messages || []) as Array<
          Record<string, unknown>
        >;
        input = dataStart?.input as typeof input;
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

            const internalCommand = parseTypebotInternalCommand(
              extractTypebotRichTextPlain(
                message as { content?: { richText?: unknown[] } }
              )
            );
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
