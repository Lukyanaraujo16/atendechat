import { MessageUpsertType, proto, WASocket } from "@whiskeysockets/baileys";
import {
  convertTextToSpeechAndSaveToFile,
  getBodyMessage,
  keepOnlySpecifiedChars,
  transferQueue,
  verifyMediaMessage,
  verifyMessage
} from "../WbotServices/wbotMessageListener";

import fs from "fs";
import path from "path";

import {
  canMakeOpenAiCalls,
  executeOpenAi,
  executeOpenAiTranscription,
  OPENAI_FALLBACK_CLIENT_MESSAGE,
  resolveOpenAiModel
} from "../OpenAi/OpenAiManager";
import { buildOpenAiSystemPromptContent } from "../OpenAi/openAiPromptHelpers";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import { logger } from "../../utils/logger";

type Session = WASocket & {
  id?: number;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IMe {
  name: string;
  id: string;
}

interface IOpenAi {
  name: string;
  prompt: string;
  /** Definido no nó Flow (FlowBuilder); fallback via resolveOpenAiModel. */
  model?: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
}

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

/**
 * OpenAI acionada pelo Webhook/FlowBuilder (`ActionsWebhookService`, nó `openai`).
 * Mesmo texto de sistema que o listener; modelo via `resolveOpenAiModel(openAiSettings.model)`.
 */
export const handleOpenAi = async (
  openAiSettings: IOpenAi,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking
): Promise<void> => {
  // REGRA PARA DESABILITAR O BOT PARA ALGUM CONTATO
  if (contact.disableBot) {
    return;
  }

  const bodyMessage = getBodyMessage(msg);
  if (!bodyMessage) return;

  if (!openAiSettings) return;

  if (msg.messageStubType) return;

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );

  const messagesDesc = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "DESC"]],
    limit: openAiSettings.maxMessages
  });
  /** Últimas N mensagens do ticket, em ordem cronológica (mais antiga → mais recente). */
  const chronologicalMessages = [...messagesDesc].reverse();

  const promptSystem = buildOpenAiSystemPromptContent({
    contactDisplayName: contact.name || "Amigo(a)",
    maxTokens: openAiSettings.maxTokens,
    instructionPrompt: openAiSettings.prompt
  });
  const resolvedModel = resolveOpenAiModel(openAiSettings.model);

  let messagesOpenAi = [];

  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    messagesOpenAi = [];
    messagesOpenAi.push({ role: "system", content: promptSystem });
    for (
      let i = 0;
      i < Math.min(openAiSettings.maxMessages, chronologicalMessages.length);
      i++
    ) {
      const message = chronologicalMessages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        if (message.fromMe) {
          messagesOpenAi.push({ role: "assistant", content: message.body });
        } else {
          messagesOpenAi.push({ role: "user", content: message.body });
        }
      }
    }
    messagesOpenAi.push({ role: "user", content: bodyMessage! });

    const chatResult = await executeOpenAi({
      companyId: ticket.companyId,
      ticketId: ticket.id,
      apiKey: openAiSettings.apiKey,
      messages: messagesOpenAi,
      model: resolvedModel,
      maxTokens: openAiSettings.maxTokens,
      temperature: openAiSettings.temperature
    });
    if (chatResult.ok === false) {
      logger.warn(
        {
          ticketId: ticket.id,
          companyId: ticket.companyId,
          error: chatResult.error
        },
        "[OpenAiService] fallback ao cliente (chat)"
      );
      const sentFallback = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${OPENAI_FALLBACK_CLIENT_MESSAGE}`
      });
      await verifyMessage(sentFallback!, ticket, contact);
      return;
    }

    let response = chatResult.content;

    if (response?.includes("Ação: Transferir para o setor de atendimento")) {
      await transferQueue(openAiSettings.queueId, ticket, contact);
      response = response
        .replace("Ação: Transferir para o setor de atendimento", "")
        .trim();
    }

    if (openAiSettings.voice === "texto") {
      logger.info(response);
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${response!}`
      });
      await verifyMessage(sentMessage!, ticket, contact);
    } else {
      const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
      convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(response!),
        `${publicFolder}/${fileNameWithOutExtension}`,
        openAiSettings.voiceKey,
        openAiSettings.voiceRegion,
        openAiSettings.voice,
        "mp3"
      ).then(async () => {
        try {
          const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
            audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
            mimetype: "audio/mpeg",
            ptt: true
          });
          await verifyMediaMessage(
            sendMessage!,
            ticket,
            contact,
            ticketTraking,
            false,
            false,
            wbot
          );
          deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
          deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
        } catch (error) {
          logger.warn({ err: error }, "[OpenAiService] erro ao enviar áudio TTS");
        }
      });
    }
  } else if (msg.message?.audioMessage) {
    if (!(await canMakeOpenAiCalls(ticket.companyId, 2))) {
      logger.warn(
        { ticketId: ticket.id, companyId: ticket.companyId },
        "[OpenAiService] limite diário OpenAI (transcrição + chat)"
      );
      const sentLimit = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${OPENAI_FALLBACK_CLIENT_MESSAGE}`
      });
      await verifyMessage(sentLimit!, ticket, contact);
      return;
    }

    const mediaUrl = mediaSent!.mediaUrl!.split("/").pop();
    const file = fs.createReadStream(`${publicFolder}/${mediaUrl}`) as any;

    const transResult = await executeOpenAiTranscription({
      companyId: ticket.companyId,
      ticketId: ticket.id,
      apiKey: openAiSettings.apiKey,
      file
    });
    if (transResult.ok === false) {
      logger.warn(
        {
          ticketId: ticket.id,
          companyId: ticket.companyId,
          error: transResult.error
        },
        "[OpenAiService] fallback ao cliente (transcrição)"
      );
      const sentTransFallback = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${OPENAI_FALLBACK_CLIENT_MESSAGE}`
      });
      await verifyMessage(sentTransFallback!, ticket, contact);
      return;
    }

    messagesOpenAi = [];
    messagesOpenAi.push({ role: "system", content: promptSystem });
    for (
      let i = 0;
      i < Math.min(openAiSettings.maxMessages, chronologicalMessages.length);
      i++
    ) {
      const message = chronologicalMessages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        if (message.fromMe) {
          messagesOpenAi.push({ role: "assistant", content: message.body });
        } else {
          messagesOpenAi.push({ role: "user", content: message.body });
        }
      }
    }
    messagesOpenAi.push({ role: "user", content: transResult.text });

    const chatAfterAudio = await executeOpenAi({
      companyId: ticket.companyId,
      ticketId: ticket.id,
      apiKey: openAiSettings.apiKey,
      messages: messagesOpenAi,
      model: resolvedModel,
      maxTokens: openAiSettings.maxTokens,
      temperature: openAiSettings.temperature
    });
    if (chatAfterAudio.ok === false) {
      logger.warn(
        {
          ticketId: ticket.id,
          companyId: ticket.companyId,
          error: chatAfterAudio.error
        },
        "[OpenAiService] fallback ao cliente (chat pós-áudio)"
      );
      const sentAudioFallback = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${OPENAI_FALLBACK_CLIENT_MESSAGE}`
      });
      await verifyMessage(sentAudioFallback!, ticket, contact);
      return;
    }

    let response = chatAfterAudio.content;

    if (response?.includes("Ação: Transferir para o setor de atendimento")) {
      await transferQueue(openAiSettings.queueId, ticket, contact);
      response = response
        .replace("Ação: Transferir para o setor de atendimento", "")
        .trim();
    }
    if (openAiSettings.voice === "texto") {
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${response!}`
      });
      await verifyMessage(sentMessage!, ticket, contact);
    } else {
      const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
      convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(response!),
        `${publicFolder}/${fileNameWithOutExtension}`,
        openAiSettings.voiceKey,
        openAiSettings.voiceRegion,
        openAiSettings.voice,
        "mp3"
      ).then(async () => {
        try {
          const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
            audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
            mimetype: "audio/mpeg",
            ptt: true
          });
          await verifyMediaMessage(
            sendMessage!,
            ticket,
            contact,
            ticketTraking,
            false,
            false,
            wbot
          );
          deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
          deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
        } catch (error) {
          logger.warn({ err: error }, "[OpenAiService] erro ao enviar áudio TTS (pós-transcrição)");
        }
      });
    }
  }
};
