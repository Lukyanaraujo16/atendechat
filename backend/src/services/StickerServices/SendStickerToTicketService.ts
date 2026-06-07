import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { jidNormalizedUser, WAMessage } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import Sticker from "../../models/Sticker";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { getTicketRemoteJid } from "../../helpers/GetTicketRemoteJid";
import ShowTicketService from "../TicketServices/ShowTicketService";
import {
  assertUserCanAccessTicketResource,
  toTicketAccessPayload
} from "../../helpers/ticketAccess";
import SetTicketMessagesAsRead, {
  HUMAN_PANEL_SEND_MESSAGE
} from "../../helpers/SetTicketMessagesAsRead";
import CreateMessageService, {
  serializeMessageForClient
} from "../MessageServices/CreateMessageService";
import { resolveStickerAbsolutePath } from "../../helpers/stickerStorage";

interface Actor {
  id: string | number;
  profile?: string;
  supportMode?: boolean;
}

interface Request {
  stickerId: number;
  ticketId: string | number;
  companyId: number;
  actor: Actor;
}

const SendStickerToTicketService = async ({
  stickerId,
  ticketId,
  companyId,
  actor
}: Request): Promise<{ message: ReturnType<typeof serializeMessageForClient> }> => {
  const sticker = await Sticker.findOne({
    where: { id: stickerId, companyId, isActive: true }
  });

  if (!sticker) {
    throw new AppError("ERR_NO_STICKER_FOUND", 404);
  }

  const ticket = await ShowTicketService(ticketId, companyId);

  await assertUserCanAccessTicketResource(
    actor,
    toTicketAccessPayload(ticket),
    companyId
  );

  await SetTicketMessagesAsRead(ticket, HUMAN_PANEL_SEND_MESSAGE);

  const absPath = resolveStickerAbsolutePath(sticker.filePath);
  if (!fs.existsSync(absPath)) {
    throw new AppError("ERR_STICKER_FILE_MISSING", 404);
  }

  const buffer = fs.readFileSync(absPath);
  const wbot = await GetTicketWbot(ticket);

  if (
    !ticket.isGroup &&
    ticket.contact?.number &&
    ticket.contact.number !== "LID" &&
    wbot.user?.id
  ) {
    const destNumber = String(ticket.contact.number).replace(/\D/g, "");
    const myNumber = jidNormalizedUser(wbot.user.id).replace(/\D/g, "");
    if (destNumber && myNumber && destNumber === myNumber) {
      throw new AppError(
        "Não é possível enviar figurinha para o próprio número da conexão.",
        400
      );
    }
  }

  let number = await getTicketRemoteJid(ticket);
  if (!number) {
    const destNumber = String(ticket.contact?.number || "").replace(/\D/g, "");
    if (!destNumber && !ticket.isGroup) {
      throw new AppError(
        "Não foi possível obter o destino do ticket para enviar a figurinha.",
        400
      );
    }
    number = ticket.isGroup
      ? `${destNumber}@g.us`
      : `${destNumber}@s.whatsapp.net`;
  }

  const chatJid = number.includes("@") ? jidNormalizedUser(number) : number;

  let sentMessage: WAMessage;
  try {
    sentMessage = await wbot.sendMessage(chatJid, {
      sticker: buffer
    });
  } catch {
    throw new AppError("ERR_SENDING_WAPP_STICKER", 500);
  }

  const bodyLabel = sticker.name || "Figurinha";
  const idToSave =
    (sentMessage as any)?.key?.id != null
      ? String((sentMessage as any).key.id)
      : uuidv4();

  await ticket.update({ lastMessage: bodyLabel });

  const savedMessage = await CreateMessageService({
    messageData: {
      id: idToSave,
      ticketId: ticket.id,
      body: bodyLabel,
      fromMe: true,
      read: true,
      ack: (sentMessage as any)?.status,
      mediaType: "sticker",
      mediaUrl: sticker.filePath,
      ...(sentMessage ? { dataJson: JSON.stringify(sentMessage as any) } : {})
    } as any,
    companyId: ticket.companyId
  });

  return { message: serializeMessageForClient(savedMessage) };
};

export default SendStickerToTicketService;
