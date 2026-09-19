import { WAMessage, AnyMessageContent, WAPresence, jidNormalizedUser } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import AppError from "../../errors/AppError";
import { getTicketRemoteJid } from "../../helpers/GetTicketRemoteJid";
import { getWhatsAppOutboundForTicket } from "../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import Ticket from "../../models/Ticket";
import mime from "mime-types";
import Contact from "../../models/Contact";
import { isFlowBuilderDebugEnabled } from "../../utils/flowBuilderDebug";
import { logger } from "../../utils/logger";
import { isWhatsAppDisableAllReadAndPresenceSideEffects } from "../../helpers/whatsappUnavailablePresence";
import { prepareWhatsAppPttAudio } from "../WhatsAppMediaService/prepareWhatsAppPttAudio";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

interface RequestFlow {
  media: string;
  ticket: Ticket;
  body?: string;
  isFlow?: boolean;
  isRecord?: boolean;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const processAudioFile = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath.path} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        //fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

const nameFileDiscovery = (pathMedia: string) => {
  const spliting = pathMedia.split('/')
  const first = spliting[spliting.length - 1]
  return first.split(".")[0]
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export const typeSimulation = async (ticket: Ticket, presence: WAPresence) => {
  if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
    logger.info(
      `[WhatsAppPresence] suppressed context=typeSimulation presence=${presence} ticketId=${ticket.id} reason=WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE_SIDE_EFFECTS`
    );
    return;
  }

  const outbound = await getWhatsAppOutboundForTicket(ticket);

  const contact = await Contact.findOne({
    where: {
      id: ticket.contactId,
    }
  });

  let chatJid = await getTicketRemoteJid(ticket);
  if (!chatJid && contact) {
    const dest = String(contact.number || "").replace(/\D/g, "");
    chatJid = ticket.isGroup ? `${dest}@g.us` : `${dest}@s.whatsapp.net`;
  }
  if (!chatJid) return;

  const jid = chatJid.includes("@") ? jidNormalizedUser(chatJid) : chatJid;
  await outbound.sendPresence({
    jid,
    presence: presence as "composing" | "paused" | "unavailable",
    subscribe: false
  });
  await delay(5000);
  await outbound.sendPresence({ jid, presence: "paused" });

}

const SendWhatsAppMediaFlow = async ({
  media,
  ticket,
  body,
  isFlow = false,
  isRecord = false
}: RequestFlow): Promise<WAMessage> => {
  try {
    const outbound = await getWhatsAppOutboundForTicket(ticket);

    const pathMedia = path.resolve(media);
    const mimetype = mime.lookup(pathMedia);
    const fileExists = fs.existsSync(pathMedia);
    const mediaName = nameFileDiscovery(pathMedia);

    let typeMessage = "";
    if (typeof mimetype === "string") {
      typeMessage = mimetype.split("/")[0];
    }

    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          flowMediaSend: true,
          ticketId: ticket.id,
          pathMedia,
          fileExists,
          mimetype: mimetype || "(mime não detectado)",
          typeMessage: typeMessage || "(vazio)",
          fileName: mediaName,
          isFlow
        },
        "[FlowBuilder][debug] SendWhatsAppMediaFlow: arquivo antes do envio"
      );
    }

    if (!fileExists) {
      const errMsg = `Arquivo de mídia não encontrado: ${pathMedia}`;
      logger.error({ flowMediaSend: true, ticketId: ticket.id, pathMedia }, errMsg);
      throw new AppError(errMsg, 400);
    }

    let options: AnyMessageContent | undefined;

    if (mimetype) {
      if (typeMessage === "video") {
        options = {
          video: fs.readFileSync(pathMedia),
          caption: body || ""
        };
      } else if (typeMessage === "audio") {
        if (isRecord) {
          const prepared = await prepareWhatsAppPttAudio({
            sourcePath: pathMedia,
            provider: outbound.provider,
            unlinkSource: false
          });
          options = {
            audio: fs.readFileSync(prepared.outputPath),
            mimetype: prepared.mimetype,
            ptt: prepared.ptt
          };
        } else {
          const convert = await processAudioFile(pathMedia);
          options = {
            audio: fs.readFileSync(convert),
            mimetype:
              outbound.provider === "evolution" ? "audio/mpeg" : "audio/mp4",
            ptt: false
          };
        }
      } else if (typeMessage === "image") {
        /** Antes não havia ramo para image/* — options ficava undefined e a mídia não era enviada. */
        options = {
          image: fs.readFileSync(pathMedia),
          caption: body || ""
        };
      } else if (typeMessage === "document" || typeMessage === "text") {
        options = {
          document: fs.readFileSync(pathMedia),
          caption: body,
          fileName: path.basename(pathMedia),
          mimetype: mimetype
        };
      } else if (typeMessage === "application") {
        options = {
          document: fs.readFileSync(pathMedia),
          caption: body,
          fileName: path.basename(pathMedia),
          mimetype: mimetype
        };
      }
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: body || ""
      };
    }

    if (!options) {
      const errMsg = `Tipo de mídia não suportado ou não mapeado (mime: ${String(mimetype)}, tipo: ${typeMessage})`;
      logger.error(
        { flowMediaSend: true, ticketId: ticket.id, mimetype, typeMessage },
        errMsg
      );
      throw new AppError(errMsg, 400);
    }

    const payloadSummary = Object.fromEntries(
      Object.entries(options as Record<string, unknown>).map(([k, v]) => [
        k,
        Buffer.isBuffer(v) ? `<Buffer len=${v.length}>` : v
      ])
    );

    let chatJid = await getTicketRemoteJid(ticket);
    if (!chatJid) {
      const contactRow = await Contact.findOne({
        where: { id: ticket.contactId }
      });
      const destNumber = String(contactRow?.number || "").replace(/\D/g, "");
      if (ticket.isGroup) {
        chatJid = `${destNumber}@g.us`;
      } else if (!destNumber) {
        throw new AppError("Não foi possível obter o destino da mídia (LID sem remoteJid).");
      } else {
        chatJid = `${destNumber}@s.whatsapp.net`;
      }
    }
    const dest = chatJid.includes("@") ? jidNormalizedUser(chatJid) : chatJid;

    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          flowMediaSend: true,
          ticketId: ticket.id,
          destJid: dest,
          payloadKeys: Object.keys(options),
          payloadSummary
        },
        "[FlowBuilder][debug] SendWhatsAppMediaFlow: enviando ao WhatsApp (buffers resumidos)"
      );
    }

    const sent = await outbound.sendContent({
      jid: dest,
      content: { ...options }
    });
    const sentMessage = sent.rawSentMessage as WAMessage;

    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          flowMediaSend: true,
          ticketId: ticket.id,
          destJid: dest,
          messageId: (sentMessage as any)?.key?.id,
          success: true
        },
        "[FlowBuilder][debug] SendWhatsAppMediaFlow: envio concluído"
      );
    }

    await ticket.update({ lastMessage: mediaName });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    logger.error(
      {
        flowMediaSend: true,
        ticketId: ticket?.id,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      },
      "[FlowBuilder] SendWhatsAppMediaFlow: falha no envio"
    );
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(
      `ERR_SENDING_WAPP_MSG: ${err instanceof Error ? err.message : String(err)}`
    );
  }
};

export default SendWhatsAppMediaFlow;
