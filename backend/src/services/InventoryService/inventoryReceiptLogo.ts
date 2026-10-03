import crypto from "crypto";
import fs from "fs";
import path from "path";

import AppError from "../../errors/AppError";
import uploadConfig from "../../config/upload";
import InventorySettings from "../../models/InventorySettings";
import GetOrCreateInventorySettingsService from "./GetOrCreateInventorySettingsService";

export const RECEIPT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
const PUBLIC_PREFIX = "/public/inventory-receipts/";
const FILE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/i;

type LogoKind = "png" | "jpg" | "webp";

const MIME_BY_KIND: Record<LogoKind, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  webp: ["image/webp"]
};

export function receiptLogoRoot(): string {
  const override = process.env.INVENTORY_RECEIPT_LOGO_ROOT;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.resolve(uploadConfig.directory, "inventory-receipts");
}

function assertCompanyId(companyId: number): void {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
}

export function companyLogoDir(companyId: number): string {
  assertCompanyId(companyId);
  return path.resolve(receiptLogoRoot(), `company-${companyId}`);
}

export function detectReceiptLogoKind(buffer: Buffer): LogoKind | null {
  if (!buffer || buffer.length < 12) return null;
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function extensionKind(originalName: string): LogoKind | null {
  const ext = path.extname(originalName || "").toLowerCase();
  if (ext === ".png") return "png";
  if (ext === ".jpg" || ext === ".jpeg") return "jpg";
  if (ext === ".webp") return "webp";
  return null;
}

function mimeMatches(kind: LogoKind, mimetype: string): boolean {
  return MIME_BY_KIND[kind].includes((mimetype || "").toLowerCase());
}

export function validateReceiptLogoFile(input: {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
}): LogoKind {
  if (!input.buffer || input.buffer.length === 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Selecione uma imagem.");
  }
  if (input.buffer.length > RECEIPT_LOGO_MAX_BYTES) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "A imagem deve ter no máximo 2 MB."
    );
  }
  const fromName = extensionKind(input.originalName);
  const fromBytes = detectReceiptLogoKind(input.buffer);
  if (
    !fromName ||
    !fromBytes ||
    fromName !== fromBytes ||
    !mimeMatches(fromBytes, input.mimetype)
  ) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Use uma imagem PNG, JPG ou WEBP."
    );
  }
  return fromBytes;
}

export function confinedReceiptLogoFile(
  companyId: number,
  stored: string | null | undefined
): string | null {
  if (!stored || typeof stored !== "string") return null;
  assertCompanyId(companyId);
  const prefix = `${PUBLIC_PREFIX}company-${companyId}/`;
  if (!stored.startsWith(prefix)) return null;
  const filename = stored.slice(prefix.length);
  if (!FILE_NAME.test(filename)) return null;
  const dir = companyLogoDir(companyId);
  const absolute = path.resolve(dir, filename);
  const relative = path.relative(dir, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    return null;
  return absolute;
}

export function publicReceiptLogoPath(
  companyId: number,
  filename: string
): string {
  return `${PUBLIC_PREFIX}company-${companyId}/${filename}`;
}

async function removeConfined(
  companyId: number,
  stored: string | null | undefined
): Promise<void> {
  const absolute = confinedReceiptLogoFile(companyId, stored);
  if (!absolute) return;
  try {
    await fs.promises.unlink(absolute);
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code !== "ENOENT") throw error;
  }
}

export async function uploadInventoryReceiptLogo(input: {
  companyId: number;
  buffer: Buffer;
  mimetype: string;
  originalName: string;
}): Promise<{ receiptLogoUrl: string }> {
  const kind = validateReceiptLogoFile(input);
  const settings = await GetOrCreateInventorySettingsService(input.companyId);
  const previous = settings.receiptLogoUrl;
  const dir = companyLogoDir(input.companyId);
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${kind}`;
  const absolute = path.resolve(dir, filename);
  const receiptLogoUrl = publicReceiptLogoPath(input.companyId, filename);
  await fs.promises.writeFile(absolute, input.buffer);
  try {
    await settings.update({ receiptLogoUrl });
  } catch (error) {
    await removeConfined(input.companyId, receiptLogoUrl);
    throw error;
  }
  if (previous && previous !== receiptLogoUrl) {
    await removeConfined(input.companyId, previous);
  }
  return { receiptLogoUrl };
}

export async function removeInventoryReceiptLogo(
  companyId: number
): Promise<{ receiptLogoUrl: null }> {
  const settings = await GetOrCreateInventorySettingsService(companyId);
  const previous = settings.receiptLogoUrl;
  await settings.update({ receiptLogoUrl: null });
  await removeConfined(companyId, previous);
  return { receiptLogoUrl: null };
}

export function receiptLogoReference(
  settings: InventorySettings
): string | null {
  const stored = settings.receiptLogoUrl;
  if (!stored) return null;
  if (!confinedReceiptLogoFile(settings.companyId, stored)) return null;
  return stored;
}
