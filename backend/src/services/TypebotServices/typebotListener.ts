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
        typebotSessionId: null,
        isBot: true
      });

      await ticket.reload();
    }

    if (isNil(ticket.typebotSessionId)) {
      dataStart = await createSession(typebot, number);
      sessionId = dataStart.sessionId;
      status = true;
      await ticket.update({
        typebotSessionId: sessionId,
        typebotStatus: true,
        useIntegration: true,
        integrationId: typebot.id
      });
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
        await outbound.sendText({
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

            if (formattedText.startsWith("#")) {
              const gatilho = formattedText.replace("#", "");
              const jsonGatilho = JSON.parse(gatilho);

              if (
                jsonGatilho.stopBot &&
                isNil(jsonGatilho.userId) &&
                isNil(jsonGatilho.queueId)
              ) {
                await ticket.update({
                  useIntegration: false,
                  isBot: false
                });

                return;
              }
              if (
                !isNil(jsonGatilho.queueId) &&
                jsonGatilho.queueId > 0 &&
                isNil(jsonGatilho.userId)
              ) {
                await UpdateTicketService({
                  ticketData: {
                    queueId: jsonGatilho.queueId,
                    chatbot: false,
                    useIntegration: false,
                    integrationId: null
                  },
                  ticketId: ticket.id,
                  companyId: ticket.companyId
                });

                return;
              }

              if (
                !isNil(jsonGatilho.queueId) &&
                jsonGatilho.queueId > 0 &&
                !isNil(jsonGatilho.userId) &&
                jsonGatilho.userId > 0
              ) {
                await UpdateTicketService({
                  ticketData: {
                    queueId: jsonGatilho.queueId,
                    userId: jsonGatilho.userId,
                    chatbot: false,
                    useIntegration: false,
                    integrationId: null
                  },
                  ticketId: ticket.id,
                  companyId: ticket.companyId
                });

                return;
              }
            }

            await runTypebotTypingSimulation(
              outbound,
              remoteJid,
              typebotDelayMessage,
              "typebot:text_reply",
              sleep
            );

            await outbound.sendText({
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
                ticketId: ticket.id
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
                ticketId: ticket.id
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
            await outbound.sendText({
              jid: remoteJid,
              text: formattedText
            });
          }
        }
      }
    }
    if (body === typebotKeywordRestart) {
      await ticket.update({
        isBot: true,
        typebotSessionId: null
      });

      await ticket.reload();

      await outbound.sendText({
        jid: remoteJid,
        text: typebotRestartMessage
      });
    }
    if (body === typebotKeywordFinish) {
      await UpdateTicketService({
        ticketData: {
          status: "closed",
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
