import crypto from "crypto";
import AppError from "../errors/AppError";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "aic1:";

const resolveEncryptionSecret = (): string => {
  const key =
    process.env.AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    process.env.META_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.META_APP_SECRET?.trim();

  if (!key) {
    throw new AppError(
      "ERR_AI_CREDENTIAL_ENCRYPTION_KEY_MISSING",
      500,
      "Chave de criptografia de credenciais de IA não configurada no servidor."
    );
  }

  return key;
};

const deriveKey = (): Buffer =>
  crypto.createHash("sha256").update(resolveEncryptionSecret()).digest();

export const encryptAiProviderApiKey = (plainText: string): string => {
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

export const decryptAiProviderApiKey = (stored: string): string => {
  if (!stored?.startsWith(PREFIX)) {
    throw new AppError("ERR_AI_CREDENTIAL_DECRYPT_FAILED", 500);
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
