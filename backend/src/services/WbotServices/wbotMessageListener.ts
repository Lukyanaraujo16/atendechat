import path, { join } from "path";
import { promisify } from "util";
import { readFile, writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { isNil, isNull, head } from "lodash";
import { extension as mimeExtension } from "mime-types";

import {
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  jidNormalizedUser,
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageStubType,
  WAMessageUpdate,
  WASocket
} from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";

import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import { isFlowBuilderDebugEnabled } from "../../utils/flowBuilderDebug";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../TicketServices/ShowTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import { Store } from "../../libs/store";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import { parseTicketDataWebhook } from "../../helpers/GetTicketRemoteJid";
import moment from "moment";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { Op } from "sequelize";
import { campaignQueue, parseToMilliseconds, randomValue } from "../../queues";
import User from "../../models/User";
import Setting from "../../models/Setting";
import { cacheLayer } from "../../libs/cache";
import { provider } from "./providers";
import { debounce } from "../../helpers/Debounce";
import { ChatCompletionRequestMessage } from "openai";
import {
  canMakeOpenAiCalls,
  executeOpenAi,
  executeOpenAiTranscription,
  OPENAI_FALLBACK_CLIENT_MESSAGE,
  resolveOpenAiModel
} from "../OpenAi/OpenAiManager";
import { buildOpenAiSystemPromptContent } from "../OpenAi/openAiPromptHelpers";
import ffmpeg from "fluent-ffmpeg";
import {
  SpeechConfig,
  SpeechSynthesizer,
  AudioConfig
} from "microsoft-cognitiveservices-speech-sdk";
import typebotListener from "../TypebotServices/typebotListener";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";

import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowDefaultModel } from "../../models/FlowDefault";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import { IOpenAi } from "../../@types/openai";

import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { WebhookModel } from "../../models/Webhook";

import {differenceInMilliseconds} from "date-fns";
import Whatsapp from "../../models/Whatsapp";
import tryAutoMarkIncomingWhatsAppRead from "../../helpers/TryAutoMarkIncomingWhatsAppRead";

const request = require("request");

const fs = require("fs");

type Session = WASocket & {
  id?: number;
  store?: Store;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IMe {
  name: string;
  id: string;
}

interface IMessage {
  messages: WAMessage[];
  isLatest: boolean;
}

export const isNumeric = (value: string) => /^-?\d+$/.test(value);

const writeFileAsync = promisify(writeFile);

const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  return getContentType(msg.message);
};

function hasCaption(title: string, fileName: string) {
  if(!title || !fileName) return false;

  const fileNameExtension = fileName.substring(fileName.lastIndexOf('.') + 1);

  return !fileName.includes(`${title}.${fileNameExtension}`)
}

export function validaCpfCnpj(val) {
  if (val.length == 11) {
    var cpf = val.trim();

    cpf = cpf.replace(/\./g, "");
    cpf = cpf.replace("-", "");
    cpf = cpf.split("");

    var v1 = 0;
    var v2 = 0;
    var aux = false;

    for (var i = 1; cpf.length > i; i++) {
      if (cpf[i - 1] != cpf[i]) {
        aux = true;
      }
    }

    if (aux == false) {
      return false;
    }

    for (var i = 0, p = 10; cpf.length - 2 > i; i++, p--) {
      v1 += cpf[i] * p;
    }

    v1 = (v1 * 10) % 11;

    if (v1 == 10) {
      v1 = 0;
    }

    if (v1 != cpf[9]) {
      return false;
    }

    for (var i = 0, p = 11; cpf.length - 1 > i; i++, p--) {
      v2 += cpf[i] * p;
    }

    v2 = (v2 * 10) % 11;

    if (v2 == 10) {
      v2 = 0;
    }

    if (v2 != cpf[10]) {
      return false;
    } else {
      return true;
    }
  } else if (val.length == 14) {
    var cnpj = val.trim();

    cnpj = cnpj.replace(/\./g, "");
    cnpj = cnpj.replace("-", "");
    cnpj = cnpj.replace("/", "");
    cnpj = cnpj.split("");

    var v1 = 0;
    var v2 = 0;
    var aux = false;

    for (var i = 1; cnpj.length > i; i++) {
      if (cnpj[i - 1] != cnpj[i]) {
        aux = true;
      }
    }

    if (aux == false) {
      return false;
    }

    for (var i = 0, p1 = 5, p2 = 13; cnpj.length - 2 > i; i++, p1--, p2--) {
      if (p1 >= 2) {
        v1 += cnpj[i] * p1;
      } else {
        v1 += cnpj[i] * p2;
      }
    }

    v1 = v1 % 11;

    if (v1 < 2) {
      v1 = 0;
    } else {
      v1 = 11 - v1;
    }

    if (v1 != cnpj[12]) {
      return false;
    }

    for (var i = 0, p1 = 6, p2 = 14; cnpj.length - 1 > i; i++, p1--, p2--) {
      if (p1 >= 2) {
        v2 += cnpj[i] * p1;
      } else {
        v2 += cnpj[i] * p2;
      }
    }

    v2 = v2 % 11;

    if (v2 < 2) {
      v2 = 0;
    } else {
      v2 = 11 - v2;
    }

    if (v2 != cnpj[13]) {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sleep(time) {
  await timeout(time);
}
export const sendMessageImage = async (
  wbot: Session,
  contact,
  ticket: Ticket,
  url: string,
  caption: string
) => {
  let sentMessage;
  try {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        image: url
          ? { url }
          : fs.readFileSync(`public/temp/${caption}-${makeid(10)}`),
        fileName: caption,
        caption: caption,
        mimetype: "image/jpeg"
      }
    );
  } catch (error) {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: formatBody(
          "Não consegui enviar a imagem, tente novamente!",
          contact
        )
      }
    );
  }
  verifyMessage(sentMessage, ticket, contact);
};

export const sendMessageLink = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket,
  url: string,
  caption: string
) => {
  let sentMessage;
  try {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        document: url
          ? { url }
          : fs.readFileSync(`public/temp/${caption}-${makeid(10)}`),
        fileName: caption,
        caption: caption,
        mimetype: "application/pdf"
      }
    );
  } catch (error) {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: formatBody("Não consegui enviar o PDF, tente novamente!", contact)
      }
    );
  }
  verifyMessage(sentMessage, ticket, contact);
};

export function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const getBodyButton = (msg: proto.IWebMessageInfo): string => {
  if (
    msg.key.fromMe &&
    msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText
  ) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText}*`;

    for (const buton of msg.message?.viewOnceMessage?.message?.buttonsMessage
      ?.buttons) {
      bodyMessage += `\n\n${buton.buttonText?.displayText}`;
    }
    return bodyMessage;
  }

  if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.listMessage) {
    let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.listMessage?.description}*`;
    for (const buton of msg.message?.viewOnceMessage?.message?.listMessage
      ?.sections) {
      for (const rows of buton.rows) {
        bodyMessage += `\n\n${rows.title}`;
      }
    }

    return bodyMessage;
  }
};

const msgLocation = (image, latitude, longitude) => {
  if (image) {
    var b64 = Buffer.from(image).toString("base64");

    let data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
    return data;
  }
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    let type = getTypeMessage(msg);

    const types = {
      conversation: msg?.message?.conversation,
      editedMessage:
        msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage
          ?.conversation,
      imageMessage: msg.message?.imageMessage?.caption,
      videoMessage: msg.message?.videoMessage?.caption,
      extendedTextMessage: msg.message?.extendedTextMessage?.text,
      buttonsResponseMessage:
        msg.message?.buttonsResponseMessage?.selectedButtonId,
      templateButtonReplyMessage:
        msg.message?.templateButtonReplyMessage?.selectedId,
      messageContextInfo:
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.listResponseMessage?.title,
      buttonsMessage:
        getBodyButton(msg) ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      viewOnceMessage:
        getBodyButton(msg) ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      stickerMessage: "sticker",
      contactMessage: msg.message?.contactMessage?.vcard,
      contactsArrayMessage: "varios contatos",
      //locationMessage: `Latitude: ${msg.message.locationMessage?.degreesLatitude} - Longitude: ${msg.message.locationMessage?.degreesLongitude}`,
      locationMessage: msgLocation(
        msg.message?.locationMessage?.jpegThumbnail,
        msg.message?.locationMessage?.degreesLatitude,
        msg.message?.locationMessage?.degreesLongitude
      ),
      liveLocationMessage: `Latitude: ${msg.message?.liveLocationMessage?.degreesLatitude} - Longitude: ${msg.message?.liveLocationMessage?.degreesLongitude}`,
      documentMessage: msg.message?.documentMessage?.caption,
      documentWithCaptionMessage:
        msg.message?.documentWithCaptionMessage?.message?.documentMessage
          ?.caption,
      audioMessage: "Áudio",
      listMessage:
        getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      listResponseMessage:
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      reactionMessage: msg.message?.reactionMessage?.text || "reaction"
    };

    const objKey = Object.keys(types).find(key => key === type);

    if (!objKey) {
      logger.warn(`#### Nao achou o type 152: ${type}
${JSON.stringify(msg)}`);
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, type });
      Sentry.captureException(
        new Error("Novo Tipo de Mensagem em getTypeMessage")
      );
    }
    return types[type];
  } catch (error) {
    Sentry.setExtra("Error getTypeMessage", { msg, BodyMsg: msg.message });
    Sentry.captureException(error);
    console.log(error);
  }
};

export const getQuotedMessage = (msg: proto.IWebMessageInfo): any => {
  const body =
    msg.message.imageMessage.contextInfo ||
    msg.message.videoMessage.contextInfo ||
    msg.message?.documentMessage ||
    msg.message.extendedTextMessage.contextInfo ||
    msg.message.buttonsResponseMessage.contextInfo ||
    msg.message.listResponseMessage.contextInfo ||
    msg.message.templateButtonReplyMessage.contextInfo ||
    msg.message.buttonsResponseMessage?.contextInfo ||
    msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg?.message?.listResponseMessage?.singleSelectReply.selectedRowId ||
    msg.message.listResponseMessage?.contextInfo;
  msg.message.senderKeyDistributionMessage;

  // testar isso

  return extractMessageContent(body[Object.keys(body).values().next().value]);
};
export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const body = extractMessageContent(msg.message)[
    Object.keys(msg?.message).values().next().value
  ];

  return body?.contextInfo?.stanzaId;
};

const getMeSocket = (wbot: Session): IMe => {
  return {
    id: jidNormalizedUser((wbot as WASocket).user.id),
    name: (wbot as WASocket).user.name
  };
};

const getSenderMessage = (
  msg: proto.IWebMessageInfo,
  wbot: Session
): string => {
  const me = getMeSocket(wbot);
  if (msg.key.fromMe) return me.id;

  const senderId =
    msg.participant || msg.key.participant || msg.key.remoteJid || undefined;

  return senderId && jidNormalizedUser(senderId);
};

/**
 * Para chat 1:1, retorna sempre o JID no formato @s.whatsapp.net (número real) quando disponível.
 * Quando a mensagem vem com @lid (Linked Identity), tenta obter o número real por:
 * 1. key.senderPn - número em formato string
 * 2. key.remoteJidAlt - JID alternativo com número (ex: 5511999999999@s.whatsapp.net)
 * Caso contrário retorna o LID para envio, mas o contato ficará com número "LID" para exibição.
 */
const getContactJidForChat = (msg: proto.IWebMessageInfo): string => {
  const remoteJid = msg.key.remoteJid || "";
  if (remoteJid.endsWith("@lid")) {
    const key = msg.key as { senderPn?: string; remoteJidAlt?: string };
    if (key.senderPn) {
      const phone = String(key.senderPn).replace(/\D/g, "");
      if (phone) return `${phone}@s.whatsapp.net`;
    }
    if (key.remoteJidAlt && key.remoteJidAlt.endsWith("@s.whatsapp.net")) {
      return key.remoteJidAlt;
    }
  }
  return remoteJid;
};

/**
 * Eco fromMe (resposta do bot): reutiliza o ticket do mesmo chat via Message.remoteJid.
 * Sem isso, verifyContact pode criar outro "contato" (ex.: dígitos do LID) e FindOrCreateTicketService abre 2º ticket.
 */
const findTicketForOutgoingEcho = async (
  companyId: number,
  msg: proto.IWebMessageInfo,
  whatsappId: number
): Promise<Ticket | null> => {
  if (!msg.key.fromMe || msg.key.remoteJid?.endsWith("@g.us")) {
    return null;
  }
  const candidates = new Set<string>();
  if (msg.key.remoteJid) {
    candidates.add(msg.key.remoteJid);
    try {
      candidates.add(jidNormalizedUser(msg.key.remoteJid));
    } catch {
      /* ignore */
    }
  }
  const altJid = getContactJidForChat(msg);
  if (altJid) {
    candidates.add(altJid);
    try {
      candidates.add(jidNormalizedUser(altJid));
    } catch {
      /* ignore */
    }
  }
  const list = [...candidates].filter(Boolean);
  if (!list.length) {
    return null;
  }

  const anchor = await Message.findOne({
    where: {
      companyId,
      remoteJid: { [Op.in]: list }
    },
    order: [["createdAt", "DESC"]],
    attributes: ["ticketId"]
  });
  if (!anchor?.ticketId) {
    return null;
  }

  const t = await ShowTicketService(anchor.ticketId, companyId);
  if (Number(t.whatsappId) !== Number(whatsappId)) {
    return null;
  }
  return t;
};

const getContactMessage = async (msg: proto.IWebMessageInfo, wbot: Session) => {
  const isGroup = msg.key.remoteJid.includes("g.us");
  const contactJid = isGroup ? msg.key.remoteJid : getContactJidForChat(msg);
  const rawNumber = contactJid.replace(/\D/g, "");
  return isGroup
    ? {
        id: getSenderMessage(msg, wbot),
        name: msg.pushName
      }
    : {
        id: contactJid,
        name: msg.key.fromMe ? rawNumber : msg.pushName
      };
};

const downloadMedia = async (msg: proto.IWebMessageInfo) => {
  let buffer;
  try {
    // Baileys v7 alterou os tipos esperados por downloadMediaMessage
    // Mantemos o comportamento, apenas ajustando o cast de tipagem.
    buffer = await downloadMediaMessage(msg as any, "buffer", {});
  } catch (err) {
    console.error("Erro ao baixar mídia:", err);

    // Trate o erro de acordo com as suas necessidades
  }

  let filename = msg.message?.documentMessage?.fileName || "";

  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

  if (!mineType) console.log(msg);

  if (!filename) {
    const ext = mimeExtension(mineType.mimetype);
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }

  const media = {
    data: buffer,
    mimetype: mineType.mimetype,
    filename
  };

  return media;
};

const verifyContact = async (
  msgContact: IMe,
  wbot: Session,
  companyId: number
): Promise<Contact> => {
  let profilePicUrl: string;
  try {
    profilePicUrl = await wbot.profilePictureUrl(msgContact.id);
  } catch (e) {
    Sentry.captureException(e);
    profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  // Para LID sem número resolvível: não usar dígitos do JID (não é o telefone real)
  const rawId = msgContact.id;
  const isLidWithoutNumber = rawId.endsWith("@lid");
  const number = isLidWithoutNumber
    ? "LID"
    : rawId.replace(/\D/g, "");

  const contactData = {
    name: msgContact?.name || (isLidWithoutNumber ? "Cliente" : rawId.replace(/\D/g, "")),
    number,
    profilePicUrl,
    isGroup: msgContact.id.includes("g.us"),
    companyId,
    whatsappId: wbot.id
  };

  const contact = CreateOrUpdateContactService(contactData);

  return contact;
};

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { id: quoted }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

export const convertTextToSpeechAndSaveToFile = (
  text: string,
  filename: string,
  subscriptionKey: string,
  serviceRegion: string,
  voice: string = "pt-BR-FabioNeural",
  audioToFormat: string = "mp3"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const speechConfig = SpeechConfig.fromSubscription(
      subscriptionKey,
      serviceRegion
    );
    speechConfig.speechSynthesisVoiceName = voice;
    const audioConfig = AudioConfig.fromAudioFileOutput(`${filename}.wav`);
    const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);
    synthesizer.speakTextAsync(
      text,
      result => {
        if (result) {
          convertWavToAnotherFormat(
            `${filename}.wav`,
            `${filename}.${audioToFormat}`,
            audioToFormat
          )
            .then(output => {
              resolve();
            })
            .catch(error => {
              console.error(error);
              reject(error);
            });
        } else {
          reject(new Error("No result from synthesizer"));
        }
        synthesizer.close();
      },
      error => {
        console.error(`Error: ${error}`);
        synthesizer.close();
        reject(error);
      }
    );
  });
};

const convertWavToAnotherFormat = (
  inputPath: string,
  outputPath: string,
  toFormat: string
) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .toFormat(toFormat)
      .on("end", () => resolve(outputPath))
      .on("error", (err: { message: any }) =>
        reject(new Error(`Error converting file: ${err.message}`))
      )
      .save(outputPath);
  });
};

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

export const keepOnlySpecifiedChars = (str: string) => {
  return str.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚâêîôûÂÊÎÔÛãõÃÕçÇ!?.,;:\s]/g, "");
};



/**
 * Respostas automáticas via OpenAI (limite/log na Fase 1 permanecem em OpenAiManager).
 *
 * Ordem de precedência do `prompt` efetivo:
 * 1) Nó Flow (`openAiSettings` passado pelo FlowBuilder) — apiKey/prompt/model no JSON do fluxo.
 * 2) Prompt da conexão WhatsApp (`Whatsapp.prompt` via ShowWhatsAppService).
 * 3) Prompt da fila atual (`ticket.queue.prompt`) se existir.
 *
 * Onde isso é disparado no listener (visão geral):
 * - Conexão: `whatsapp.promptId` + ticket sem fila/atendente (bloco "openai na conexão").
 * - Fila: `queues[].promptId` / escolha de fila com prompt (chatbot de setores).
 * - Ticket: ticket com `promptId` + `useIntegration` + fila (bloco "openai na fila").
 * - Flow: nó `openai` com ticket em fluxo (`isOpenai` + `openAiSettings` injetado aqui).
 */
const handleOpenAi = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking = null,
  openAiSettings = null
): Promise<void> => {

  // REGRA PARA DESABILITAR O BOT PARA ALGUM CONTATO
  if (contact.disableBot) {
    return;
  }

  const bodyMessage = getBodyMessage(msg);

  if (!bodyMessage) return;

  let { prompt } = await ShowWhatsAppService(wbot.id, ticket.companyId);

  if( openAiSettings )
    prompt = openAiSettings;

  if (!prompt && !isNil(ticket?.queue?.prompt)) {
    prompt = ticket.queue.prompt;
  }

  if (!prompt) return;

  if (msg.messageStubType) return;

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public"
  );

  let maxMessages = prompt.maxMessages;

  const messagesDesc = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "DESC"]],
    limit: maxMessages
  });
  /** Últimas N mensagens do ticket, em ordem cronológica (mais antiga → mais recente). */
  const chronologicalMessages = [...messagesDesc].reverse();

  const promptSystem = buildOpenAiSystemPromptContent({
    contactDisplayName: contact.name || "Amigo(a)",
    maxTokens: prompt.maxTokens,
    instructionPrompt: prompt.prompt
  });
  const resolvedModel = resolveOpenAiModel((prompt as { model?: string }).model);

  let messagesOpenAi: ChatCompletionRequestMessage[] = [];

  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    messagesOpenAi = [];
    messagesOpenAi.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, chronologicalMessages.length); i++) {
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
      apiKey: prompt.apiKey,
      messages: messagesOpenAi,
      model: resolvedModel,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature
    });

    if (chatResult.ok === false) {
      logger.warn(
        {
          ticketId: ticket.id,
          companyId: ticket.companyId,
          error: chatResult.error
        },
        "[handleOpenAi] fallback ao cliente (chat)"
      );
      const sentFallback = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${OPENAI_FALLBACK_CLIENT_MESSAGE}`
      });
      await verifyMessage(sentFallback!, ticket, contact);
      return;
    }

    let response = chatResult.content;

    if (response?.includes("Ação: Transferir para o setor de atendimento")) {
      await transferQueue(prompt.queueId, ticket, contact);
      response = response
        .replace("Ação: Transferir para o setor de atendimento", "")
        .trim();
    }

    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${response!}`
    });
    await verifyMessage(sentMessage!, ticket, contact);
  } else if (msg.message?.audioMessage) {
    if (!(await canMakeOpenAiCalls(ticket.companyId, 2))) {
      logger.warn(
        { ticketId: ticket.id, companyId: ticket.companyId },
        "[handleOpenAi] limite diário OpenAI (transcrição + chat)"
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
      apiKey: prompt.apiKey,
      file
    });
    if (transResult.ok === false) {
      logger.warn(
        {
          ticketId: ticket.id,
          companyId: ticket.companyId,
          error: transResult.error
        },
        "[handleOpenAi] fallback ao cliente (transcrição)"
      );
      const sentTransFallback = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${OPENAI_FALLBACK_CLIENT_MESSAGE}`
      });
      await verifyMessage(sentTransFallback!, ticket, contact);
      return;
    }

    messagesOpenAi = [];
    messagesOpenAi.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, chronologicalMessages.length); i++) {
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
      apiKey: prompt.apiKey,
      messages: messagesOpenAi,
      model: resolvedModel,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature
    });
    if (chatAfterAudio.ok === false) {
      logger.warn(
        {
          ticketId: ticket.id,
          companyId: ticket.companyId,
          error: chatAfterAudio.error
        },
        "[handleOpenAi] fallback ao cliente (chat pós-áudio)"
      );
      const sentAudioFallback = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${OPENAI_FALLBACK_CLIENT_MESSAGE}`
      });
      await verifyMessage(sentAudioFallback!, ticket, contact);
      return;
    }

    let response = chatAfterAudio.content;

    if (response?.includes("Ação: Transferir para o setor de atendimento")) {
      await transferQueue(prompt.queueId, ticket, contact);
      response = response
        .replace("Ação: Transferir para o setor de atendimento", "")
        .trim();
    }

    const sentAudioReply = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${response!}`
    });
    await verifyMessage(sentAudioReply!, ticket, contact);
  }
  messagesOpenAi = [];
};

export const transferQueue = async (
  queueId: number,
  ticket: Ticket,
  contact: Contact
): Promise<void> => {
  await UpdateTicketService({
    ticketData: { queueId: queueId },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
};

export const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking: TicketTraking = null,
  isForwarded: boolean = false,
  isPrivate: boolean = false,
  wbot: Session = null,
  readReceiptOpts?: { autoReadMessages?: boolean }
): Promise<Message> => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const media = await downloadMedia(msg);

  if (!media) {
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }

  if (!media.filename) {
    const ext = mimeExtension(media.mimetype);
    media.filename = `${new Date().getTime()}.${ext}`;
  }

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "..", "public", media.filename),
      Buffer.from(media.data, 'base64')
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }

  const body = getBodyMessage(msg);

  const hasCap = hasCaption(body, media.filename);
  const bodyMessage = body ? hasCap ? formatBody(body, ticket.contact) : "-" : "-";

  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: bodyMessage,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    mediaUrl: media.filename,
    mediaType: media.mimetype.split("/")[0],
    quotedMsgId: quotedMsg?.id,
    ack: msg.status,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    ticketTrakingId: ticketTraking?.id,
  };

  await ticket.update({
    lastMessage: body || "Arquivo de mídia"
  });

  const newMessage = await CreateMessageService({
    messageData,
    companyId: ticket.companyId
  });

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    io.to(`company-${ticket.companyId}-closed`)
      .to(`queue-${ticket.queueId}-closed`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }

  if (!msg.key.fromMe && wbot) {
    await tryAutoMarkIncomingWhatsAppRead({
      msg,
      ticket,
      wbot,
      autoReadMessages: readReceiptOpts?.autoReadMessages
    });
  }

  return newMessage;
};

/** Texto de "stub" que o WhatsApp envia quando a mensagem ainda está pendente; não usar para salvar. */
const isWhatsAppPendingStub = (text: string | null): boolean => {
  if (!text || typeof text !== "string") return false;
  const t = text.trim().toLowerCase();
  return (
    t.includes("aguardando mensagem") ||
    t.includes("saiba mais") ||
    t.includes("pode levar alguns instantes")
  );
};

export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  bodyOverride?: string,
  readReceiptOpts?: { wbot?: Session | null; autoReadMessages?: boolean }
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const extractedBody = getBodyMessage(msg);
  const fromMe = msg.key?.fromMe ?? Boolean(bodyOverride);
  const body = bodyOverride ?? extractedBody;
  const isEdited = getTypeMessage(msg) == "editedMessage";

  if (fromMe && !bodyOverride && isWhatsAppPendingStub(extractedBody)) {
    return;
  }

  const messageData = {
    id: isEdited
      ? msg?.message?.editedMessage?.message?.protocolMessage?.key?.id
      : msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body,
    fromMe,
    mediaType: getTypeMessage(msg),
    read: fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: msg.status,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    isEdited: isEdited
  };

  await ticket.update({
    lastMessage: body
  });

  await CreateMessageService({ messageData, companyId: ticket.companyId });

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    io.to(`company-${ticket.companyId}-closed`)
      .to(`queue-${ticket.queueId}-closed`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }

  if (!msg.key.fromMe && readReceiptOpts?.wbot) {
    await tryAutoMarkIncomingWhatsAppRead({
      msg,
      ticket,
      wbot: readReceiptOpts.wbot,
      autoReadMessages: readReceiptOpts.autoReadMessages
    });
  }
};

const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
  if (msg.key.remoteJid === "status@broadcast") return false;
  try {
    const msgType = getTypeMessage(msg);
    if (!msgType) {
      return;
    }

    const ifType =
      msgType === "conversation" ||
      msgType === "extendedTextMessage" ||
      msgType === "editedMessage" ||
      msgType === "audioMessage" ||
      msgType === "videoMessage" ||
      msgType === "imageMessage" ||
      msgType === "documentMessage" ||
      msgType === "documentWithCaptionMessage" ||
      msgType === "stickerMessage" ||
      msgType === "buttonsResponseMessage" ||
      msgType === "buttonsMessage" ||
      msgType === "messageContextInfo" ||
      msgType === "locationMessage" ||
      msgType === "liveLocationMessage" ||
      msgType === "contactMessage" ||
      msgType === "voiceMessage" ||
      msgType === "mediaMessage" ||
      msgType === "contactsArrayMessage" ||
      msgType === "reactionMessage" ||
      msgType === "ephemeralMessage" ||
      msgType === "protocolMessage" ||
      msgType === "listResponseMessage" ||
      msgType === "listMessage" ||
      msgType === "viewOnceMessage";

    if (!ifType) {
      logger.warn(`#### Nao achou o type em isValidMsg: ${msgType}
${JSON.stringify(msg?.message)}`);
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, msgType });
      Sentry.captureException(new Error("Novo Tipo de Mensagem em isValidMsg"));
    }

    return !!ifType;
  } catch (error) {
    Sentry.setExtra("Error isValidMsg", { msg });
    Sentry.captureException(error);
  }
};

const Push = (msg: proto.IWebMessageInfo) => {
  return msg.pushName;
};

/** Fluxos novos: primeiro node é `start`; o executável é o target da primeira aresta. Fluxos antigos: primeiro node já é message/menu/etc. */
const resolveFirstFlowExecutableNodeId = (
  nodes: INodes[],
  connections: IConnections[]
): {
  startNodeId: string | null;
  firstEdgeTarget: string | null;
  firstExecutableNodeId: string | null;
  firstExecutableNodeType: string | null;
} => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeConnections = Array.isArray(connections) ? connections : [];
  const first = safeNodes[0];
  if (!first) {
    return {
      startNodeId: null,
      firstEdgeTarget: null,
      firstExecutableNodeId: null,
      firstExecutableNodeType: null
    };
  }

  if (first.type !== "start") {
    return {
      startNodeId: first.id,
      firstEdgeTarget: null,
      firstExecutableNodeId: first.id,
      firstExecutableNodeType: first.type
    };
  }

  const startNodeId = first.id;
  const outgoing = safeConnections.filter(c => c && c.source === startNodeId);
  const firstEdge = outgoing[0];
  const firstEdgeTarget = firstEdge?.target ?? null;

  if (!firstEdgeTarget) {
    return {
      startNodeId,
      firstEdgeTarget: null,
      firstExecutableNodeId: null,
      firstExecutableNodeType: null
    };
  }

  const targetNode = safeNodes.find(n => n.id === firstEdgeTarget);
  return {
    startNodeId,
    firstEdgeTarget,
    firstExecutableNodeId: targetNode?.id ?? firstEdgeTarget,
    firstExecutableNodeType: targetNode?.type ?? null
  };
};

const verifyQueue = async (
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  mediaSent?: Message | undefined
) => {

  const companyId = ticket.companyId;

  const whatsappSession = await ShowWhatsAppService(wbot.id!, ticket.companyId);
  const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } =
    whatsappSession;

  if (queues.length === 1) {
    const sendGreetingMessageOneQueues = await Setting.findOne({
      where: {
        key: "sendGreetingMessageOneQueues",
        companyId: ticket.companyId
      }
    });

    if (
      greetingMessage.length > 1 &&
      sendGreetingMessageOneQueues?.value === "enabled"
    ) {
      const body = formatBody(`${greetingMessage}`, contact);

      await wbot.sendMessage(
        `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        {
          text: body
        }
      );
    }

    const firstQueue = head(queues);
    let chatbot = false;
    if (firstQueue?.options) {
      chatbot = firstQueue.options.length > 0;
    }

    //inicia integração dialogflow/n8n
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !isNil(queues[0]?.integrationId)
    ) {
      const integrations = await ShowQueueIntegrationService(
        queues[0].integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        null,
        whatsappSession,
        contact
      );

      await ticket.update({
        useIntegration: true,
        integrationId: integrations.id
      });
      // return;
    }
    //inicia integração openai
    if (!msg.key.fromMe && !ticket.isGroup && !isNil(queues[0]?.promptId)) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);

      await ticket.update({
        useIntegration: true,
        promptId: queues[0]?.promptId
      });
      // return;
    }

    await UpdateTicketService({
      ticketData: { queueId: firstQueue.id, chatbot, status: "pending" },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    return;
  }

  const selectedOption = getBodyMessage(msg);
  const choosenQueue = queues[+selectedOption - 1];

  const buttonActive = await Setting.findOne({
    where: {
      key: "chatBotType",
      companyId
    }
  });

  const botText = async () => {
    let options = "";

    queues.forEach((queue, index) => {
      options += `*[ ${index + 1} ]* - ${queue.name}\n`;
    });

    const textMessage = {
      text: formatBody(`\u200e${greetingMessage}\n\n${options}`, contact)
    };

    const sendMsg = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      textMessage
    );

    await verifyMessage(sendMsg, ticket, ticket.contact);
  };

  if (choosenQueue) {
    let chatbot = false;
    if (choosenQueue?.options) {
      chatbot = choosenQueue.options.length > 0;
    }

    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id, chatbot },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    /* Tratamento para envio de mensagem quando a fila está fora do expediente */
    if (choosenQueue.options.length === 0) {
      const queue = await Queue.findByPk(choosenQueue.id);
      const { schedules }: any = queue;
      const now = moment();
      const weekday = now.format("dddd").toLowerCase();
      let schedule;
      if (Array.isArray(schedules) && schedules.length > 0) {
        schedule = schedules.find(
          s =>
            s.weekdayEn === weekday &&
            s.startTime !== "" &&
            s.startTime !== null &&
            s.endTime !== "" &&
            s.endTime !== null
        );
      }

      if (
        queue.outOfHoursMessage !== null &&
        queue.outOfHoursMessage !== "" &&
        !isNil(schedule)
      ) {
        const startTime = moment(schedule.startTime, "HH:mm");
        const endTime = moment(schedule.endTime, "HH:mm");

        if (now.isBefore(startTime) || now.isAfter(endTime)) {
          const body = formatBody(
            `\u200e ${queue.outOfHoursMessage}\n\n*[ # ]* - Voltar ao Menu Principal`,
            ticket.contact
          );
          const sentMessage = await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            {
              text: body
            }
          );
          await verifyMessage(sentMessage, ticket, contact);
          await UpdateTicketService({
            ticketData: { queueId: null, chatbot },
            ticketId: ticket.id,
            companyId: ticket.companyId
          });
          return;
        }
      }

      //inicia integração dialogflow/n8n
      if (!msg.key.fromMe && !ticket.isGroup && choosenQueue.integrationId) {
        const integrations = await ShowQueueIntegrationService(
          choosenQueue.integrationId,
          companyId
        );

        await handleMessageIntegration(
          msg,
          wbot,
          integrations,
          ticket,
          companyId,
          null,
          whatsappSession,
          contact
        );

        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        });
        // return;
      }

      //inicia integração openai
      if (
        !msg.key.fromMe &&
        !ticket.isGroup &&
        !isNil(choosenQueue?.promptId)
      ) {
        await handleOpenAi(msg, wbot, ticket, contact, mediaSent);

        await ticket.update({
          useIntegration: true,
          promptId: choosenQueue?.promptId
        });
        // return;
      }

      const body = formatBody(
        `\u200e${choosenQueue.greetingMessage}`,
        ticket.contact
      );
      if (choosenQueue.greetingMessage) {
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );
        await verifyMessage(sentMessage, ticket, contact);
      }
    }
  } else {
    if (
      maxUseBotQueues &&
      maxUseBotQueues !== 0 &&
      ticket.amountUsedBotQueues >= maxUseBotQueues
    ) {
      // await UpdateTicketService({
      //   ticketData: { queueId: queues[0].id },
      //   ticketId: ticket.id
      // });

      return;
    }

    //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId
    });
    let dataLimite = new Date();
    let Agora = new Date();

    if (ticketTraking.chatbotAt !== null) {
      dataLimite.setMinutes(
        ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
      );

      if (
        ticketTraking.chatbotAt !== null &&
        Agora < dataLimite &&
        timeUseBotQueues !== "0" &&
        ticket.amountUsedBotQueues !== 0
      ) {
        return;
      }
    }
    await ticketTraking.update({
      chatbotAt: null
    });

    if (buttonActive.value === "text") {
      return botText();
    }
  }
};

export const verifyRating = (ticketTraking: TicketTraking) => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt !== null
  ) {
    return true;
  }
  return false;
};

/** Escala alinhada à mensagem de avaliação no WhatsApp (1–3). */
export const RATING_SCALE_MIN = 1;
export const RATING_SCALE_MAX = 3;

/**
 * Interpreta a resposta do cliente. Retorna null se não for uma nota válida (ignora sem erro).
 */
export const parseRatingResponse = (bodyMessage: string): number | null => {
  const raw = String(bodyMessage ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/,/g, ".").trim();
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < RATING_SCALE_MIN || rounded > RATING_SCALE_MAX) return null;
  return rounded;
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();

  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  let finalRate = rate;
  if (!Number.isFinite(finalRate)) {
    finalRate = RATING_SCALE_MIN;
  }
  if (finalRate < RATING_SCALE_MIN) {
    finalRate = RATING_SCALE_MIN;
  }
  if (finalRate > RATING_SCALE_MAX) {
    finalRate = RATING_SCALE_MAX;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate
  });

  if (complationMessage) {
    const body = formatBody(`\u200e${complationMessage}`, ticket.contact);
    await SendWhatsAppMessage({ body, ticket });
  }

  await ticketTraking.update({
    finishedAt: moment().toDate(),
    rated: true
  });

  await ticket.update({
    queueId: null,
    chatbot: null,
    queueOptionId: null,
    userId: null,
    status: "closed"
  });

  io.to(`company-${ticket.companyId}-open`)
    .to(`queue-${ticket.queueId}-open`)
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

  io.to(`company-${ticket.companyId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(ticket.id.toString())
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
};

const handleChartbot = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  dontReadTheFirstQuestion: boolean = false
) => {
  const queue = await Queue.findByPk(ticket.queueId, {
    include: [
      {
        model: QueueOption,
        as: "options",
        where: { parentId: null },
        order: [
          ["option", "ASC"],
          ["createdAt", "ASC"]
        ]
      }
    ]
  });

  const messageBody = getBodyMessage(msg);

  if (messageBody == "#") {
    // voltar para o menu inicial
    await ticket.update({ queueOptionId: null, chatbot: false, queueId: null });
    await verifyQueue(wbot, msg, ticket, ticket.contact);
    return;
  }

  // voltar para o menu anterior
  if (!isNil(queue) && !isNil(ticket.queueOptionId) && messageBody == "0") {
    const option = await QueueOption.findByPk(ticket.queueOptionId);
    await ticket.update({ queueOptionId: option?.parentId });

    // escolheu uma opção
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const count = await QueueOption.count({
      where: { parentId: ticket.queueOptionId }
    });
    let option: any = {};
    if (count == 1) {
      option = await QueueOption.findOne({
        where: { parentId: ticket.queueOptionId }
      });
    } else {
      option = await QueueOption.findOne({
        where: {
          option: messageBody || "",
          parentId: ticket.queueOptionId
        }
      });
    }
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }

    // não linha a primeira pergunta
  } else if (
    !isNil(queue) &&
    isNil(ticket.queueOptionId) &&
    !dontReadTheFirstQuestion
  ) {
    const option = queue?.options.find(o => o.option == messageBody);
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }
  }

  await ticket.reload();

  if (!isNil(queue) && isNil(ticket.queueOptionId)) {
    const queueOptions = await QueueOption.findAll({
      where: { queueId: ticket.queueId, parentId: null },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    const companyId = ticket.companyId;

    const buttonActive = await Setting.findOne({
      where: {
        key: "chatBotType",
        companyId
      }
    });

    // const botList = async () => {
    // const sectionsRows = [];

    // queues.forEach((queue, index) => {
    //   sectionsRows.push({
    //     title: queue.name,
    //     rowId: `${index + 1}`
    //   });
    // });

    // const sections = [
    //   {
    //     rows: sectionsRows
    //   }
    // ];

    //   const listMessage = {
    //     text: formatBody(`\u200e${queue.greetingMessage}`, ticket.contact),
    //     buttonText: "Escolha uma opção",
    //     sections
    //   };

    //   const sendMsg = await wbot.sendMessage(
    //     `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
    //     listMessage
    //   );

    //   await verifyMessage(sendMsg, ticket, ticket.contact);
    // }

    const botButton = async () => {
      const buttons = [];
      queueOptions.forEach((option, i) => {
        buttons.push({
          buttonId: `${option.option}`,
          buttonText: { displayText: option.title },
          type: 4
        });
      });
      buttons.push({
        buttonId: `#`,
        buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
        type: 4
      });

      const buttonMessage = {
        text: formatBody(`\u200e${queue.greetingMessage}`, ticket.contact),
        buttons,
        headerType: 4
      };

      const sendMsg = await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        buttonMessage
      );

      await verifyMessage(sendMsg, ticket, ticket.contact);
    };

    const botText = async () => {
      let options = "";

      queueOptions.forEach((option, i) => {
        options += `*[ ${option.option} ]* - ${option.title}\n`;
      });
      //options += `\n*[ 0 ]* - Menu anterior`;
      options += `\n*[ # ]* - Menu inicial`;

      const textMessage = {
        text: formatBody(
          `\u200e${queue.greetingMessage}\n\n${options}`,
          ticket.contact
        )
      };

      const sendMsg = await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        textMessage
      );

      await verifyMessage(sendMsg, ticket, ticket.contact);
    };

    // if (buttonActive.value === "list") {
    //   return botList();
    // };

    if (buttonActive.value === "button" && QueueOption.length <= 4) {
      return botButton();
    }

    if (buttonActive.value === "text") {
      return botText();
    }

    if (buttonActive.value === "button" && QueueOption.length > 4) {
      return botText();
    }
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const currentOption = await QueueOption.findByPk(ticket.queueOptionId);
    const queueOptions = await QueueOption.findAll({
      where: { parentId: ticket.queueOptionId },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    if (queueOptions.length > -1) {
      const companyId = ticket.companyId;
      const buttonActive = await Setting.findOne({
        where: {
          key: "chatBotType",
          companyId
        }
      });

      const botList = async () => {
        const sectionsRows = [];

        queueOptions.forEach((option, i) => {
          sectionsRows.push({
            title: option.title,
            rowId: `${option.option}`
          });
        });
        sectionsRows.push({
          title: "Menu inicial *[ 0 ]* Menu anterior",
          rowId: `#`
        });
        const sections = [
          {
            rows: sectionsRows
          }
        ];

        const listMessage = {
          text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
          buttonText: "Escolha uma opção",
          sections
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          listMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      const botButton = async () => {
        const buttons = [];
        queueOptions.forEach((option, i) => {
          buttons.push({
            buttonId: `${option.option}`,
            buttonText: { displayText: option.title },
            type: 4
          });
        });
        buttons.push({
          buttonId: `#`,
          buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
          type: 4
        });

        const buttonMessage = {
          text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
          buttons,
          headerType: 4
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          buttonMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      const botText = async () => {
        let options = "";

        queueOptions.forEach((option, i) => {
          options += `*[ ${option.option} ]* - ${option.title}\n`;
        });
        options += `\n*[ 0 ]* - Menu anterior`;
        options += `\n*[ # ]* - Menu inicial`;
        const textMessage = {
          text: formatBody(
            `\u200e${currentOption.message}\n\n${options}`,
            ticket.contact
          )
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          textMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      if (buttonActive.value === "list") {
        return botList();
      }

      if (buttonActive.value === "button" && QueueOption.length <= 4) {
        return botButton();
      }

      if (buttonActive.value === "text") {
        return botText();
      }

      if (buttonActive.value === "button" && QueueOption.length > 4) {
        return botText();
      }
    }
  }
};

const flowbuilderIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  contact: Contact | null,
  isFirstMsg?: Ticket,
  isTranfered?: boolean
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);

  /*
  const messageData = {
    wid: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: body,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: Number(String(msg.status).replace('PENDING', '2').replace('NaN', '1')) || 2,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    createdAt: new Date(
      Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
    ).toISOString(),
    ticketImported: ticket.imported,
  };


  await CreateMessageService({ messageData, companyId: ticket.companyId });

  */

  if (!msg.key.fromMe && ticket.status === "closed") {

    console.log("===== CHANGE =====");
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });
    await UpdateTicketService({
      ticketData: { status: "pending", integrationId: ticket.integrationId },
      ticketId: ticket.id,
      companyId
    });

    io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

    io.to(ticket.status).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
  }

  if (msg.key.fromMe) {
    return;
  }

  let contactForFlow: Contact | null = contact;
  if (!contactForFlow && ticket.contactId) {
    contactForFlow = await Contact.findByPk(ticket.contactId);
  }
  if (!contactForFlow) {
    logger.warn(
      { ticketId: ticket.id, companyId },
      "[FlowBuilder] flowbuilderIntegration: contact ausente; passe contact em handleMessageIntegration ou garanta ticket.contactId"
    );
    return;
  }

  const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);

  const listPhrase = await FlowCampaignModel.findAll({
    where: {
      whatsappId: whatsapp.id
    }
  });

  if (isFlowBuilderDebugEnabled()) {
    logger.info(
      {
        flowBuilderEntry: true,
        stage: "flowbuilderIntegration:start",
        body: body?.slice?.(0, 500) ?? body,
        ticketId: ticket.id,
        queueId: ticket.queueId,
        flowWebhook: ticket.flowWebhook,
        flowStopped: ticket.flowStopped,
        whatsappId: whatsapp.id,
        flowIdWelcome: whatsapp.flowIdWelcome,
        flowIdNotPhrase: whatsapp.flowIdNotPhrase,
        isFirstMsgTicketId: isFirstMsg?.id ?? null
      },
      "[FlowBuilder][debug] entrada flowbuilderIntegration"
    );
  }

  // Welcome flow — não usar !isFirstMsg: isFirstMsg costuma ser o próprio ticket atual (find DESC) e bloqueava o welcome nas rotas que passam esse parâmetro.
  if (
    !ticket.flowWebhook &&
    listPhrase.filter(item => item.phrase.toLowerCase() === body.toLowerCase()).length === 0
  ) {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdWelcome
      }
    });
    if (!flow) {
      logger.warn(
        {
          flowBuilderWelcome: true,
          whatsappId: whatsapp.id,
          flowIdWelcome: whatsapp.flowIdWelcome
        },
        "[FlowBuilder][DEBUG] welcome: fluxo não encontrado (configure flowIdWelcome na conexão WhatsApp)"
      );
    }
    if (flow) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];
      const resolved = resolveFirstFlowExecutableNodeId(nodes, connections);

      if (isFlowBuilderDebugEnabled()) {
        logger.info(
          {
            flowBuilderWelcome: true,
            flowId: whatsapp.flowIdWelcome,
            startNodeId: resolved.startNodeId,
            firstEdgeTarget: resolved.firstEdgeTarget,
            firstExecutableNodeId: resolved.firstExecutableNodeId,
            firstExecutableNodeType: resolved.firstExecutableNodeType,
            ticketId: ticket.id
          },
          "[FlowBuilder][debug] welcome: primeiro node executável resolvido"
        );
      }

      if (!resolved.firstExecutableNodeId) {
        logger.warn(
          {
            flowBuilderWelcome: true,
            flowId: whatsapp.flowIdWelcome,
            startNodeId: resolved.startNodeId,
            firstEdgeTarget: resolved.firstEdgeTarget
          },
          "[FlowBuilder] welcome: sem conexão saindo do start (ou fluxo vazio); não disparando ActionsWebhookService"
        );
      } else {
        await UpdateTicketService({
          ticketData: { chatbot: true },
          ticketId: ticket.id,
          companyId: ticket.companyId
        });

        const mountDataContact = {
          number: contactForFlow.number,
          name: contactForFlow.name,
          email: contactForFlow.email
        };

        await ActionsWebhookService(
          whatsapp.id,
          whatsapp.flowIdWelcome,
          ticket.companyId,
          nodes,
          connections,
          resolved.firstExecutableNodeId,
          null,
          "",
          "",
          null,
          ticket.id,
          mountDataContact,
          msg
        );
      }
    }
  }

  const dateTicket = new Date(
    isFirstMsg?.updatedAt ? isFirstMsg.updatedAt : ""
  );

  const dateNow = new Date();
  const diferencaEmMilissegundos = Math.abs(
    differenceInMilliseconds(dateTicket, dateNow)
  );
  //const seisHorasEmMilissegundos = 21600000;
  const seisHorasEmMilissegundos = 0;

  // Flow with not found phrase
  if (
    listPhrase.filter(item => item.phrase.toLowerCase() === body.toLowerCase()).length === 0 &&
    diferencaEmMilissegundos >= seisHorasEmMilissegundos &&
    isFirstMsg
  ) {
    console.log("2427", "handleMessageIntegration");

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdNotPhrase
      }
    });

    if (flow) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];
      const resolvedNp = resolveFirstFlowExecutableNodeId(nodes, connections);

      if (!resolvedNp.firstExecutableNodeId) {
        logger.warn(
          {
            flowBuilderNotPhrase: true,
            flowId: whatsapp.flowIdNotPhrase,
            startNodeId: resolvedNp.startNodeId,
            firstEdgeTarget: resolvedNp.firstEdgeTarget
          },
          "[FlowBuilder] flowIdNotPhrase: sem primeiro node executável; abortando"
        );
      } else {
        await UpdateTicketService({
          ticketData: { chatbot: true },
          ticketId: ticket.id,
          companyId: ticket.companyId
        });

        const mountDataContact = {
          number: contactForFlow.number,
          name: contactForFlow.name,
          email: contactForFlow.email
        };

        await ActionsWebhookService(
          whatsapp.id,
          whatsapp.flowIdNotPhrase,
          ticket.companyId,
          nodes,
          connections,
          resolvedNp.firstExecutableNodeId,
          null,
          "",
          "",
          null,
          ticket.id,
          mountDataContact,
          msg
        );
      }
    }
  }

  // Campaign fluxo
  if (listPhrase.filter(item => item.phrase.toLowerCase() === body.toLowerCase()).length !== 0) {

    const flowDispar = listPhrase.filter(item => item.phrase.toLowerCase() === body.toLowerCase())[0];
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: flowDispar.flowId
      }
    });
    const nodes: INodes[] = flow.flow["nodes"];
    const connections: IConnections[] = flow.flow["connections"];
    const resolvedCamp = resolveFirstFlowExecutableNodeId(nodes, connections);

    if (!resolvedCamp.firstExecutableNodeId) {
      logger.warn(
        {
          flowBuilderCampaign: true,
          flowId: flowDispar.flowId,
          startNodeId: resolvedCamp.startNodeId,
          firstEdgeTarget: resolvedCamp.firstEdgeTarget
        },
        "[FlowBuilder] campanha: sem primeiro node executável; abortando"
      );
      return;
    }

    const mountDataContact = {
      number: contactForFlow.number,
      name: contactForFlow.name,
      email: contactForFlow.email
    };

    //const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

    //console.log('DISPARO3')
    // Enviar as variáveis como parte da mensagem para o Worker
    // const data = {
    //   idFlowDb: flowDispar.flowId,
    //   companyId: ticketUpdate.companyId,
    //   nodes: nodes,
    //   connects: connections,
    //   nextStage: flow.flow["nodes"][0].id,
    //   dataWebhook: null,
    //   details: "",
    //   hashWebhookId: "",
    //   pressKey: null,
    //   idTicket: ticketUpdate.id,
    //   numberPhrase: mountDataContact
    // };
    // worker.postMessage(data);

    // worker.on("message", message => {
    //   console.log(`Mensagem do worker: ${message}`);
    // });

    await ActionsWebhookService(
      whatsapp.id,
      flowDispar.flowId,
      ticket.companyId,
      nodes,
      connections,
      resolvedCamp.firstExecutableNodeId,
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact
    );
    return;
  }

  if (ticket.flowWebhook) {
    const webhook = await WebhookModel.findOne({
      where: {
        company_id: ticket.companyId,
        hash_id: ticket.hashFlowId
      }
    });

    if (webhook && webhook.config["details"]) {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: webhook.config["details"].idFlow
        }
      });
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // console.log('DISPARO4')
      // // Enviar as variáveis como parte da mensagem para o Worker
      // const data = {
      //   idFlowDb: webhook.config["details"].idFlow,
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: ticketUpdate.lastFlowId,
      //   dataWebhook: ticketUpdate.dataWebhook,
      //   details: webhook.config["details"],
      //   hashWebhookId: ticketUpdate.hashFlowId,
      //   pressKey: body,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: ""
      // };
      // worker.postMessage(data);

      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      if (isFlowBuilderDebugEnabled()) {
        logger.info(
          {
            flowBuilderInbound: true,
            body,
            lastFlowId: ticket.lastFlowId,
            flowStopped: ticket.flowStopped,
            hashFlowId: ticket.hashFlowId
          },
          "[FlowBuilder][debug] fluxo ativo (webhook config): chamando ActionsWebhookService"
        );
      }

      await ActionsWebhookService(
        whatsapp.id,
        webhook.config["details"].idFlow,
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        ticket.dataWebhook,
        webhook.config["details"],
        ticket.hashFlowId,
        body,
        ticket.id
      );
    } else {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped
        }
      });

      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      if (!ticket.lastFlowId) {
        return;
      }

      const mountDataContact = {
        number: contactForFlow.number,
        name: contactForFlow.name,
        email: contactForFlow.email
      };

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // console.log('DISPARO5')
      // // Enviar as variáveis como parte da mensagem para o Worker
      // const data = {
      //   idFlowDb: parseInt(ticketUpdate.flowStopped),
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: ticketUpdate.lastFlowId,
      //   dataWebhook: null,
      //   details: "",
      //   hashWebhookId: "",
      //   pressKey: body,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: mountDataContact
      // };
      // worker.postMessage(data);
      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      if (isFlowBuilderDebugEnabled()) {
        logger.info(
          {
            flowBuilderInbound: true,
            body,
            lastFlowId: ticket.lastFlowId,
            flowStopped: ticket.flowStopped
          },
          "[FlowBuilder][debug] fluxo ativo (flowStopped): chamando ActionsWebhookService"
        );
      }

      await ActionsWebhookService(
        whatsapp.id,
        parseInt(ticket.flowStopped),
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        null,
        "",
        "",
        body,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }
};

export const handleMessageIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  companyId: number,
  isMenu: boolean = null,
  whatsapp: Whatsapp = null,
  contact: Contact = null,
  isFirstMsg: Ticket | null = null,
): Promise<void> => {
  const msgType = getTypeMessage(msg);

  if (queueIntegration.type === "n8n" || queueIntegration.type === "webhook") {
    if (queueIntegration?.urlN8N) {
      const options = {
        method: "POST",
        url: queueIntegration?.urlN8N,
        headers: {
          "Content-Type": "application/json"
        },
        json: msg
      };
      try {
        request(options, function (error, response) {
          if (error) {
            throw new Error(error);
          } else {
            console.log(response.body);
          }
        });
      } catch (error) {
        throw new Error(error);
      }
    }
  } else if (queueIntegration.type === "typebot") {
    // await typebots(ticket, msg, wbot, queueIntegration);
    await typebotListener({ ticket, msg, wbot, typebot: queueIntegration });
  } else if(queueIntegration.type === "flowbuilder") {
    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          flowBuilderEntry: true,
          stage: "handleMessageIntegration:flowbuilder",
          integrationId: queueIntegration.id,
          integrationName: queueIntegration.name,
          isMenu,
          ticketId: ticket.id,
          queueId: ticket.queueId,
          isFirstMsgTicketId: isFirstMsg?.id ?? null
        },
        "[FlowBuilder][debug] handleMessageIntegration → flowbuilder"
      );
    }
    if (!isMenu) {

      await flowbuilderIntegration(
        msg,
        wbot,
        companyId,
        queueIntegration,
        ticket,
        contact,
        isFirstMsg
      );
    } else {

      if (
        !isNaN(parseInt(ticket.lastMessage)) &&
        ticket.status !== "open" &&
        ticket.status !== "closed"
      ) {
        await flowBuilderQueue(
          ticket,
          msg,
          wbot,
          whatsapp,
          companyId,
          contact,
          isFirstMsg
        );
      }
    }
  }
};

const flowBuilderQueue = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number,
  contact: Contact,
  isFirstMsg: Ticket
) => {
  const body = getBodyMessage(msg);

  const flow = await FlowBuilderModel.findOne({
    where: {
      id: ticket.flowStopped
    }
  });

  const mountDataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email
  };

  const nodes: INodes[] = flow.flow["nodes"];
  const connections: IConnections[] = flow.flow["connections"];

  if (!ticket.lastFlowId) {
    return;
  }

  if (
    ticket.status === "closed" ||
    ticket.status === "interrupted" ||
    ticket.status === "open"
  ) {
    return;
  }

  await ActionsWebhookService(
    whatsapp.id,
    parseInt(ticket.flowStopped),
    ticket.companyId,
    nodes,
    connections,
    ticket.lastFlowId,
    null,
    "",
    "",
    body,
    ticket.id,
    mountDataContact,
    msg
  );

  //const integrations = await ShowQueueIntegrationService(whatsapp.integrationId, companyId);
  //await handleMessageIntegration(msg, wbot, integrations, ticket, companyId, true, whatsapp);
};


const handleMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<void> => {
  let mediaSent: Message | undefined;

  if (!isValidMsg(msg)) return;

  try {
    let msgContact: IMe;
    let groupContact: Contact | undefined;

    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    const msgIsGroupBlock = await Setting.findOne({
      where: {
        companyId,
        key: "CheckMsgIsGroup"
      }
    });

    const bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);

    const hasMedia =
      msg.message?.audioMessage ||
      msg.message?.imageMessage ||
      msg.message?.videoMessage ||
      msg.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage ||
      msg.message.stickerMessage;
    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage)) return;

      if (
        !hasMedia &&
        msgType !== "conversation" &&
        msgType !== "extendedTextMessage" &&
        msgType !== "vcard"
      )
        return;
      msgContact = await getContactMessage(msg, wbot);
    } else {
      msgContact = await getContactMessage(msg, wbot);
    }

    if (msgIsGroupBlock?.value === "enabled" && isGroup) return;

    // Nunca criar/atualizar ticket para o próprio número (evita resposta ir para "si mesmo")
    if (!isGroup && msg.key.remoteJid) {
      const myId = (wbot as WASocket).user?.id;
      if (myId) {
        const contactJid = getContactJidForChat(msg);
        const remoteNumber = contactJid.replace(/\D/g, "");
        const myNumber = jidNormalizedUser(myId).replace(/\D/g, "");
        if (remoteNumber && myNumber && remoteNumber === myNumber) return;
      }
    }

    if (isGroup) {
      const grupoMeta = await wbot.groupMetadata(msg.key.remoteJid);
      const msgGroupContact = {
        id: grupoMeta.id,
        name: grupoMeta.subject
      };
      groupContact = await verifyContact(msgGroupContact, wbot, companyId);
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);

    let contact: Contact;
    let ticketFromEcho: Ticket | null = null;

    if (!isGroup && msg.key.fromMe) {
      ticketFromEcho = await findTicketForOutgoingEcho(
        companyId,
        msg,
        whatsapp.id
      );
      if (ticketFromEcho) {
        contact = ticketFromEcho.contact;
        if (isFlowBuilderDebugEnabled()) {
          logger.info(
            {
              flowBuilderFromMeEcho: true,
              ticketId: ticketFromEcho.id,
              contactId: contact.id,
              contactNumber: contact.number,
              remoteJid: msg.key.remoteJid
            },
            "[FlowBuilder][debug] fromMe echo: ticket reutilizado"
          );
        }
      }
    }

    if (!ticketFromEcho) {
      contact = await verifyContact(msgContact, wbot, companyId);
    }

    let unreadMessages = 0;

    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(
        `contacts:${contact.id}:unreads`,
        `${unreadMessages}`
      );
    }

    const lastMessage = await Message.findOne({
      where: {
        contactId: contact.id,
        companyId
      },
      order: [["createdAt", "DESC"]]
    });

    if (
      unreadMessages === 0 &&
      whatsapp.complationMessage &&
      formatBody(whatsapp.complationMessage, contact).trim().toLowerCase() ===
        lastMessage?.body.trim().toLowerCase()
    ) {
      return;
    }

    let ticket: Ticket;

    if (ticketFromEcho) {
      ticket = ticketFromEcho;
      await ticket.update({ unreadMessages });
    } else {
      ticket = await FindOrCreateTicketService(
        contact,
        wbot.id!,
        unreadMessages,
        companyId,
        groupContact
      );
    }

    // Persistir remoteJid para envio correto (essencial em conversas LID)
    const existingData = parseTicketDataWebhook(ticket.dataWebhook);
    if (msg.key.remoteJid) {
      await ticket.update({
        dataWebhook: { ...existingData, remoteJid: msg.key.remoteJid }
      } as any);
    }

    if (!msg.key.fromMe) {
      await ticket.reload();
      if (isFlowBuilderDebugEnabled()) {
        logger.info(
          {
            flowBuilderHandleMsg: true,
            ticketId: ticket.id,
            contactId: contact.id,
            contactNumber: contact.number,
            ticketContactId: ticket.contactId,
            ticketWhatsappId: ticket.whatsappId,
            ticketQueueId: ticket.queueId,
            remoteJid: msg.key.remoteJid
          },
          "[FlowBuilder][debug] handleMessage: ticket/contato após FindOrCreate + remoteJid"
        );
      }
    }

    if (!ticket.isGroup) {
      await provider(ticket, msg, companyId, contact, wbot as WASocket);
    }

    // voltar para o menu inicial

    if (bodyMessage == "#" && !ticket.isGroup) {
      await ticket.update({
        queueOptionId: null,
        chatbot: false,
        queueId: null
      });
      await verifyQueue(wbot, msg, ticket, ticket.contact);
      return;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: whatsapp?.id
    });

    try {
      if (!msg.key.fromMe && !ticket.isGroup) {

        if (ticketTraking !== null && verifyRating(ticketTraking)) {
          const parsed = parseRatingResponse(bodyMessage);
          if (parsed !== null) {
            await handleRating(parsed, ticket, ticketTraking);
          }
          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    // Atualiza o ticket se a ultima mensagem foi enviada por mim, para que possa ser finalizado.
    try {
      await ticket.update({
        fromMe: msg.key.fromMe
      });
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    const readReceiptOpts = {
      wbot,
      autoReadMessages: whatsapp.autoReadMessages !== false
    };

    if (hasMedia) {
      mediaSent = await verifyMediaMessage(
        msg,
        ticket,
        contact,
        null,
        false,
        false,
        wbot,
        readReceiptOpts
      );
    } else {
      await verifyMessage(msg, ticket, contact, undefined, readReceiptOpts);
    }

    if (ticket.isGroup) {
      return;
    }

    const currentSchedule = await VerifyCurrentSchedule(companyId);
    const scheduleType = await Setting.findOne({
      where: {
        companyId,
        key: "scheduleType"
      }
    });

    try {
      if (!msg.key.fromMe && scheduleType) {
        /**
         * Tratamento para envio de mensagem quando a empresa está fora do expediente
         */
        if (
          scheduleType.value === "company" &&
          !isNil(currentSchedule) &&
          (!currentSchedule || currentSchedule.inActivity === false)
        ) {
          const body = `\u200e ${whatsapp.outOfHoursMessage}`;

          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${
                  ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            3000,
            ticket.id
          );
          debouncedSentMessage();
          return;
        }

        if (scheduleType.value === "queue" && ticket.queueId !== null) {
          /**
           * Tratamento para envio de mensagem quando a fila está fora do expediente
           */
          const queue = await Queue.findByPk(ticket.queueId);

          const { schedules }: any = queue;
          const now = moment();
          const weekday = now.format("dddd").toLowerCase();
          let schedule = null;

          if (Array.isArray(schedules) && schedules.length > 0) {
            schedule = schedules.find(
              s =>
                s.weekdayEn === weekday &&
                s.startTime !== "" &&
                s.startTime !== null &&
                s.endTime !== "" &&
                s.endTime !== null
            );
          }

          if (
            scheduleType.value === "queue" &&
            queue.outOfHoursMessage !== null &&
            queue.outOfHoursMessage !== "" &&
            !isNil(schedule)
          ) {
            const startTime = moment(schedule.startTime, "HH:mm");
            const endTime = moment(schedule.endTime, "HH:mm");

            if (now.isBefore(startTime) || now.isAfter(endTime)) {
              const body = `${queue.outOfHoursMessage}`;
              const debouncedSentMessage = debounce(
                async () => {
                  await wbot.sendMessage(
                    `${ticket.contact.number}@${
                      ticket.isGroup ? "g.us" : "s.whatsapp.net"
                    }`,
                    {
                      text: body
                    }
                  );
                },
                3000,
                ticket.id
              );
              debouncedSentMessage();
              return;
            }
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: ticket.flowStopped
      }
    });

    let isMenu = false;
    let isOpenai = false;
    let isQuestion = false;
    let isWaitForInteraction = false;

    if (flow) {
      isMenu =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "menu";
      isOpenai =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "openai";
      isQuestion =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "question";
      isWaitForInteraction =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "waitForInteraction";
    }

    if (!isNil(flow) && isWaitForInteraction && !msg.key.fromMe) {
      const connections: IConnections[] = flow.flow["connections"];
      const nextConnection = connections.find(
        (c: any) => c.source === ticket.lastFlowId
      );
      if (nextConnection) {
        const nextNodeId = nextConnection.target;
        await ticket.update({ lastFlowId: nextNodeId });

        const nodes: INodes[] = flow.flow["nodes"];
        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };

        await ActionsWebhookService(
          whatsapp.id,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          nextNodeId,
          null,
          "",
          "",
          "",
          ticket.id,
          mountDataContact,
          msg
        );
      }
      return;
    }

    if (!isNil(flow) && isQuestion && !msg.key.fromMe) {
      const body = getBodyMessage(msg);
      if (body) {
        const nodes: INodes[] = flow.flow["nodes"];
        const nodeSelected = flow.flow["nodes"].find(
          (node: any) => node.id === ticket.lastFlowId
        );

        const connections: IConnections[] = flow.flow["connections"];

        const { answerKey } = nodeSelected.data.typebotIntegration || {};
        const key = String(answerKey ?? "").trim();
        if (!key) {
          logger.warn(
            { ticketId: ticket.id, lastFlowId: ticket.lastFlowId },
            "[FlowBuilder] pergunta sem answerKey configurado"
          );
          return;
        }

        const nextConnection = connections.find(
          (c: any) => c.source === ticket.lastFlowId
        );
        if (!nextConnection?.target) {
          logger.warn(
            {
              ticketId: ticket.id,
              lastFlowId: ticket.lastFlowId,
              edgesFromSource: connections
                .filter((c: any) => c.source === ticket.lastFlowId)
                .map((c: any) => c.target)
            },
            "[FlowBuilder] pergunta sem aresta de saída (conecte o nó ao próximo passo)"
          );
          return;
        }
        const lastFlowId = nextConnection.target;

        const prevDw = parseTicketDataWebhook(ticket.dataWebhook);
        const prevVars =
          prevDw.variables && typeof prevDw.variables === "object" && !Array.isArray(prevDw.variables)
            ? (prevDw.variables as Record<string, unknown>)
            : {};
        await ticket.update({
          lastFlowId: lastFlowId,
          dataWebhook: {
            ...prevDw,
            variables: {
              ...prevVars,
              [key]: body
            }
          } as any
        });

        await ticket.save();

        logger.info(
          {
            flowBuilderQuestionAnswer: true,
            ticketId: ticket.id,
            answerKey: key,
            valuePreview: body.slice(0, 120),
            nextNodeId: lastFlowId,
            varsCount: Object.keys({ ...prevVars, [key]: body }).length
          },
          "[FlowBuilder] variável salva em ticket.dataWebhook.variables"
        );

        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };

        await ActionsWebhookService(
          whatsapp.id,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          lastFlowId,
          null,
          "",
          "",
          "",
          ticket.id,
          mountDataContact,
          msg
        );
      }

      return;
    }

    if (isOpenai && !isNil(flow) && !ticket.queue) {
      const nodeSelected = flow.flow["nodes"].find(
        (node: any) => node.id === ticket.lastFlowId
      );
      let {
        name,
        prompt,
        model,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens,
        temperature,
        apiKey,
        queueId,
        maxMessages
      } = nodeSelected.data.typebotIntegration as IOpenAi;

      let openAiSettings = {
        name,
        prompt,
        model: model && String(model).trim() ? String(model).trim() : undefined,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens: parseInt(String(maxTokens), 10) || 100,
        temperature: parseFloat(String(temperature ?? "1")) || 1,
        apiKey,
        queueId: parseInt(String(queueId), 10),
        maxMessages: parseInt(String(maxMessages), 10) || 10
      };

      await handleOpenAi(
        msg,
        wbot,
        ticket,
        contact,
        mediaSent,
        ticketTraking,
        openAiSettings,
      );

      return;
    }

    //openai na conexao
    if (
      !ticket.queue &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(whatsapp.promptId)
    ) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);
    }

    //integraçao na conexao
    const wbotSessionId = Number(wbot.id);
    const whatsappDbRow = await Whatsapp.findByPk(ticket.whatsappId, {
      attributes: ["id", "name", "integrationId", "flowIdWelcome", "flowIdNotPhrase"]
    });
    const queuesLinked = (whatsapp.queues || []).map((q: Queue) => ({
      id: q.id,
      name: q.name,
      integrationId: q.integrationId ?? null
    }));
    const singleQueueIntegrationId =
      whatsapp.queues?.length === 1
        ? whatsapp.queues[0]?.integrationId ?? null
        : null;
    const sessionVsTicketMatch = ticket.whatsappId === wbotSessionId;
    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          flowBuilderGate: "connection_pre",
          ticketId: ticket.id,
          ticketWhatsappId: ticket.whatsappId,
          wbotSessionId,
          sessionVsTicketMatch,
          whatsappFromShowId: whatsapp.id,
          whatsappFromShowName: whatsapp.name,
          whatsappIntegrationId: whatsapp.integrationId,
          whatsappFlowIdWelcome: whatsapp.flowIdWelcome,
          whatsappDbId: whatsappDbRow?.id ?? null,
          whatsappDbName: whatsappDbRow?.name ?? null,
          whatsappDbIntegrationId: whatsappDbRow?.integrationId ?? null,
          whatsappDbFlowIdWelcome: whatsappDbRow?.flowIdWelcome ?? null,
          showVsDbIntegrationMatch:
            whatsapp.integrationId === (whatsappDbRow?.integrationId ?? null),
          queueId: ticket.queueId,
          queueIntegrationIdFromTicket: ticket.queue?.integrationId ?? null,
          queuesLinkedCount: whatsapp.queues?.length ?? 0,
          queuesLinked,
          singleQueueIntegrationId,
          hint:
            !whatsapp.integrationId && !whatsappDbRow?.integrationId && singleQueueIntegrationId
              ? "Integração só na FILA (Queues.integrationId); Whatsapps.integrationId está null — o gate da conexão usa só a coluna da tabela Whatsapps"
              : !whatsapp.queues?.length
                ? "Nenhuma fila vinculada à conexão — verifyQueue não roda e fila/integração por fila não aplicam"
                : null,
          chatbot: ticket.chatbot,
          hasQueue: !!ticket.queue,
          hasUser: !!ticket.user,
          useIntegration: ticket.useIntegration
        },
        "[FlowBuilder][debug] checagem integração na conexão (antes do if)"
      );
    }
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact
      );

      return;
    }

    //openai na fila
    if (
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(ticket.promptId) &&
      ticket.useIntegration &&
      ticket.queueId
    ) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);
    }

    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.userId &&
      ticket.integrationId &&
      ticket.useIntegration &&
      ticket.queue
    ) {
      console.log("entrou no type 1974");
      const integrations = await ShowQueueIntegrationService(
        ticket.integrationId,
        companyId
      );

      const isFirstMsg = await Ticket.findOne({
        where: {
          contactId: groupContact ? groupContact.id : contact.id,
          companyId,
          whatsappId: whatsapp.id
        },
        order: [["id", "DESC"]]
      });

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    if (
      !ticket.queue &&
      !ticket.isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1 &&
      !ticket.useIntegration
    ) {
      await verifyQueue(wbot, msg, ticket, contact);

      if (ticketTraking && ticketTraking.chatbotAt === null) {
        await ticketTraking.update({
          chatbotAt: moment().toDate()
        });
      }
    }

    const isFirstMsg = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId: whatsapp.id
      },
      order: [["id", "DESC"]]
    });

    await ticket.reload({
      include: [{ model: Queue, as: "queue" }]
    });

    // integração flowbuilder (fallback: ex.: ticket sem queue em memória após verifyQueue ou fluxo sem retorno antecipado)
    const whatsappDbPost = await Whatsapp.findByPk(ticket.whatsappId, {
      attributes: ["id", "name", "integrationId", "flowIdWelcome", "flowIdNotPhrase"]
    });
    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          flowBuilderGate: "connection_post_verifyQueue",
          ticketId: ticket.id,
          ticketWhatsappId: ticket.whatsappId,
          wbotSessionId,
          whatsappFromShowId: whatsapp.id,
          whatsappFromShowName: whatsapp.name,
          whatsappIntegrationId: whatsapp.integrationId,
          whatsappFlowIdWelcome: whatsapp.flowIdWelcome,
          whatsappDbIntegrationId: whatsappDbPost?.integrationId ?? null,
          whatsappDbFlowIdWelcome: whatsappDbPost?.flowIdWelcome ?? null,
          hasQueue: !!ticket.queue,
          queueId: ticket.queueId,
          queueIntegrationIdFromTicket: ticket.queue?.integrationId ?? null,
          queuesLinkedCount: whatsapp.queues?.length ?? 0,
          queuesLinked,
          singleQueueIntegrationId,
          hasUser: !!ticket.user,
          useIntegration: ticket.useIntegration,
          isFirstMsgTicketId: isFirstMsg?.id ?? null
        },
        "[FlowBuilder][debug] checagem integração na conexão (após verifyQueue)"
      );
    }
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    const dontReadTheFirstQuestion = ticket.queue === null;

    await ticket.reload();

    try {
      //Fluxo fora do expediente
      if (!msg.key.fromMe && scheduleType && ticket.queueId !== null) {
        /**
         * Tratamento para envio de mensagem quando a fila está fora do expediente
         */
        const queue = await Queue.findByPk(ticket.queueId);

        const { schedules }: any = queue;
        const now = moment();
        const weekday = now.format("dddd").toLowerCase();
        let schedule = null;

        if (Array.isArray(schedules) && schedules.length > 0) {
          schedule = schedules.find(
            s =>
              s.weekdayEn === weekday &&
              s.startTime !== "" &&
              s.startTime !== null &&
              s.endTime !== "" &&
              s.endTime !== null
          );
        }

        if (
          scheduleType.value === "queue" &&
          queue.outOfHoursMessage !== null &&
          queue.outOfHoursMessage !== "" &&
          !isNil(schedule)
        ) {
          const startTime = moment(schedule.startTime, "HH:mm");
          const endTime = moment(schedule.endTime, "HH:mm");

          if (now.isBefore(startTime) || now.isAfter(endTime)) {
            const body = queue.outOfHoursMessage;
            const debouncedSentMessage = debounce(
              async () => {
                await wbot.sendMessage(
                  `${ticket.contact.number}@${
                    ticket.isGroup ? "g.us" : "s.whatsapp.net"
                  }`,
                  {
                    text: body
                  }
                );
              },
              3000,
              ticket.id
            );
            debouncedSentMessage();
            return;
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    if (
      !whatsapp?.queues?.length &&
      !ticket.userId &&
      !isGroup &&
      !msg.key.fromMe
    ) {
      const lastMessage = await Message.findOne({
        where: {
          ticketId: ticket.id,
          fromMe: true
        },
        order: [["createdAt", "DESC"]]
      });

      if (lastMessage && lastMessage.body.includes(whatsapp.greetingMessage)) {
        return;
      }

      if (whatsapp.greetingMessage) {
        const debouncedSentMessage = debounce(
          async () => {
            await wbot.sendMessage(
              `${ticket.contact.number}@${
                ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: whatsapp.greetingMessage
              }
            );
          },
          1000,
          ticket.id
        );
        debouncedSentMessage();
        return;
      }
    }

    if (whatsapp.queues.length == 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(ticket, msg, wbot);
      }
    }

    if (whatsapp.queues.length > 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(ticket, msg, wbot, dontReadTheFirstQuestion);
      }
    }

  } catch (err) {
    console.log(err);
    Sentry.captureException(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};

const handleMsgAck = async (
  msg: WAMessage,
  chat: number | null | undefined
) => {
  await new Promise(r => setTimeout(r, 500));
  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(msg.key.id, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (!messageToUpdate) return;
    await messageToUpdate.update({ ack: chat });
    io.to(messageToUpdate.ticketId.toString()).emit(
      `company-${messageToUpdate.companyId}-appMessage`,
      {
        action: "update",
        message: messageToUpdate
      }
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

const verifyCampaignMessageAndCloseTicket = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  const io = getIO();
  const body = getBodyMessage(message);
  const isCampaign = /\u200c/.test(body);
  if (message.key.fromMe && isCampaign) {
    const messageRecord = await Message.findOne({
      where: { id: message.key.id!, companyId }
    });
    const ticket = await Ticket.findByPk(messageRecord.ticketId);
    await ticket.update({ status: "closed" });

    io.to(`company-${ticket.companyId}-open`)
      .to(`queue-${ticket.queueId}-open`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }
};

const filterMessages = (msg: WAMessage): boolean => {
  if (msg.message?.protocolMessage) return false;

  if (
    [
      WAMessageStubType.REVOKE,
      WAMessageStubType.E2E_DEVICE_CHANGED,
      WAMessageStubType.E2E_IDENTITY_CHANGED,
      WAMessageStubType.CIPHERTEXT
    ].includes(msg.messageStubType)
  )
    return false;

  return true;
};

const wbotMessageListener = async (
  wbot: Session,
  companyId: number
): Promise<void> => {
  try {
    wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
      const messages = messageUpsert.messages
        .filter(filterMessages)
        .map(msg => msg);

      if (!messages) return;

      for (const message of messages) {
        const messageExists = await Message.count({
          where: { id: message.key.id!, companyId }
        });

        if (!messageExists) {
          await handleMessage(message, wbot, companyId);
          await verifyCampaignMessageAndCloseTicket(message, companyId);
        }
      }
    });

    wbot.ev.on("messages.update", (messageUpdate: WAMessageUpdate[]) => {
      if (messageUpdate.length === 0) return;
      messageUpdate.forEach(async (message: WAMessageUpdate) => {
        (wbot as WASocket)!.readMessages([message.key]);

        handleMsgAck(message, message.update.status);
      });
    });

    // wbot.ev.on("messages.set", async (messageSet: IMessage) => {
    //   messageSet.messages.filter(filterMessages).map(msg => msg);
    // });
  } catch (error) {
    Sentry.captureException(error);
    logger.error(`Error handling wbot message listener. Err: ${error}`);
  }
};

export { wbotMessageListener, handleMessage };
