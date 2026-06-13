import crypto from "crypto";
import AppError from "../errors/AppError";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "v1:";

const resolveEncryptionSecret = (): string => {
  const key =
    process.env.META_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.META_APP_SECRET?.trim();

  if (!key) {
    throw new AppError(
      "ERR_META_TOKEN_ENCRYPTION_KEY_MISSING",
      500,
      "Chave de criptografia de tokens Meta não configurada. Defina META_TOKEN_ENCRYPTION_KEY no servidor."
    );
  }

  return key;
};

const deriveKey = (): Buffer =>
  crypto.createHash("sha256").update(resolveEncryptionSecret()).digest();

export const assertMetaTokenEncryptionConfigured = (): void => {
  resolveEncryptionSecret();
};

export const encryptMetaToken = (plainText: string): string => {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `${PREFIX}${payload}`;
};

export const decryptMetaToken = (stored: string): string => {
  if (!stored?.startsWith(PREFIX)) {
    throw new AppError("ERR_META_TOKEN_DECRYPT_FAILED", 500);
  }

  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
};

export const hasEncryptedMetaToken = (stored: string | null | undefined): boolean =>
  Boolean(stored?.startsWith(PREFIX));
