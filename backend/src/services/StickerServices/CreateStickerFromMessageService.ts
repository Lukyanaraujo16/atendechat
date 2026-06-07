import fs from "fs";
import path from "path";
import sharp from "sharp";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Sticker from "../../models/Sticker";
import { resolvePublicMediaStat } from "../../helpers/resolvePublicMediaStat";
import { computeStickerFileHash } from "../../helpers/stickerFileHash";
import { isStickerMessage } from "../../helpers/isStickerMessage";
import {
  assertUserCanAccessTicketResource,
  toTicketAccessPayload
} from "../../helpers/ticketAccess";
import {
  buildStickerRelativePath,
  ensureStickerCompanyDir
} from "../../helpers/stickerStorage";
import {
  buildStickerFileName,
  processStickerToWebp
} from "../../helpers/stickerImageProcessing";
import { incrementCompanyStorageUsage } from "../CompanyService/adjustCompanyStorageUsage";

interface Actor {
  id: string | number;
  profile?: string;
  supportMode?: boolean;
}

interface Request {
  messageId: string;
  companyId: number;
  userId: number;
  actor: Actor;
  name?: string;
}

interface Response {
  sticker: Sticker;
  duplicate: boolean;
}

function assertStickerMediaBelongsToCompany(
  rawRel: string,
  companyId: number
): void {
  const norm = String(rawRel || "").replace(/\\/g, "/");
  const match = norm.match(/^stickers\/company-(\d+)\//i);
  if (!match) return;

  const ownerId = Number(match[1]);
  if (!Number.isFinite(ownerId) || ownerId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
}

function buildDefaultStickerName(ticket?: Ticket): string {
  const contactName = ticket?.contact?.name;
  if (contactName) {
    return `Figurinha ${contactName}`.slice(0, 120);
  }
  const date = new Date().toLocaleDateString("pt-BR");
  return `Figurinha ${date}`;
}

async function detectImageMime(buffer: Buffer): Promise<string> {
  try {
    const meta = await sharp(buffer).metadata();
    const format = String(meta.format || "").toLowerCase();
    if (format === "webp") return "image/webp";
    if (format === "png") return "image/png";
    if (format === "jpeg" || format === "jpg") return "image/jpeg";
  } catch {
    /* fallback abaixo */
  }
  return "image/webp";
}

const CreateStickerFromMessageService = async ({
  messageId,
  companyId,
  userId,
  actor,
  name
}: Request): Promise<Response> => {
  const message = await Message.findOne({
    where: { id: messageId, companyId },
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number", "isGroup", "companyId"]
          },
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["id", "name", "status", "ticketVisibility"],
            required: false
          }
        ]
      }
    ]
  });

  if (!message) {
    throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  }

  if (!message.ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (Number(message.ticket.companyId) !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await assertUserCanAccessTicketResource(
    actor,
    toTicketAccessPayload(message.ticket),
    companyId
  );

  if (!isStickerMessage(message)) {
    throw new AppError("ERR_NO_STICKER_MESSAGE", 400);
  }

  const rawRel = String(message.getDataValue("mediaUrl") || "").trim();
  if (!rawRel) {
    throw new AppError("ERR_STICKER_FILE_MISSING", 404);
  }

  assertStickerMediaBelongsToCompany(rawRel, companyId);

  const libraryPrefix = `stickers/company-${companyId}/`;
  if (rawRel.replace(/\\/g, "/").startsWith(libraryPrefix)) {
    const existingByPath = await Sticker.findOne({
      where: { companyId, filePath: rawRel, isActive: true }
    });
    if (existingByPath) {
      return { sticker: existingByPath, duplicate: true };
    }
  }

  const stat = resolvePublicMediaStat(rawRel);
  if (stat.missing || !stat.absPath) {
    throw new AppError("ERR_STICKER_FILE_MISSING", 404);
  }

  let sourceBuffer: Buffer;
  try {
    sourceBuffer = fs.readFileSync(stat.absPath);
  } catch {
    throw new AppError("ERR_STICKER_FILE_MISSING", 404);
  }

  if (!sourceBuffer.length) {
    throw new AppError("ERR_STICKER_FILE_MISSING", 404);
  }

  let webpBuffer: Buffer;
  try {
    const mime = await detectImageMime(sourceBuffer);
    webpBuffer = await processStickerToWebp(sourceBuffer, mime);
  } catch (err: any) {
    if (
      err?.message === "STICKER_TOO_LARGE" ||
      err?.message === "STICKER_CONVERSION_FAILED"
    ) {
      throw err;
    }
    throw new AppError("STICKER_CONVERSION_FAILED", 400);
  }

  const fileHash = computeStickerFileHash(webpBuffer);
  const existingByHash = await Sticker.findOne({
    where: { companyId, fileHash, isActive: true }
  });
  if (existingByHash) {
    return { sticker: existingByHash, duplicate: true };
  }

  const fileName = buildStickerFileName(`message-${messageId}.webp`);
  const folder = ensureStickerCompanyDir(companyId);
  const absolutePath = path.join(folder, fileName);
  fs.writeFileSync(absolutePath, webpBuffer);

  const filePath = buildStickerRelativePath(companyId, fileName);
  const displayName =
    (name && String(name).trim()) || buildDefaultStickerName(message.ticket);

  const sticker = await Sticker.create({
    companyId,
    name: displayName,
    fileName,
    filePath,
    mimeType: "image/webp",
    size: webpBuffer.length,
    fileHash,
    createdBy: userId,
    isActive: true,
    sortOrder: 0
  });

  if (webpBuffer.length > 0) {
    void incrementCompanyStorageUsage(companyId, webpBuffer.length);
  }

  return { sticker, duplicate: false };
};

export default CreateStickerFromMessageService;
