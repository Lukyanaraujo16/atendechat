import crypto from "crypto";
import AppError from "../errors/AppError";

/**
 * Criptografia autenticada de secrets Efí (plataforma).
 * Padrão alinhado a aiProviderCredentialCrypto — chave exclusiva, sem fallback.
 * Formato versionado: efic1:<base64(iv|tag|ciphertext)>
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
export const EFI_CREDENTIAL_CRYPTO_PREFIX = "efic1:";

const resolveEncryptionSecret = (): string => {
  const key = process.env.EFI_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new AppError(
      "ERR_EFI_CREDENTIAL_ENCRYPTION_KEY_MISSING",
      500,
      "Chave EFI_CREDENTIAL_ENCRYPTION_KEY não configurada no servidor."
    );
  }
  return key;
};

const deriveKey = (): Buffer =>
  crypto.createHash("sha256").update(resolveEncryptionSecret()).digest();

function packCiphertext(iv: Buffer, tag: Buffer, encrypted: Buffer): string {
  return `${EFI_CREDENTIAL_CRYPTO_PREFIX}${Buffer.concat([
    iv,
    tag,
    encrypted
  ]).toString("base64")}`;
}

function unpackCiphertext(stored: string): {
  iv: Buffer;
  tag: Buffer;
  encrypted: Buffer;
} {
  if (!stored?.startsWith(EFI_CREDENTIAL_CRYPTO_PREFIX)) {
    throw new AppError(
      "ERR_EFI_CREDENTIAL_DECRYPT_FAILED",
      500,
      "Formato de credencial Efí inválido ou versão não suportada."
    );
  }
  const raw = Buffer.from(
    stored.slice(EFI_CREDENTIAL_CRYPTO_PREFIX.length),
    "base64"
  );
  if (raw.length <= IV_LENGTH + TAG_LENGTH) {
    throw new AppError(
      "ERR_EFI_CREDENTIAL_DECRYPT_FAILED",
      500,
      "Payload cifrado Efí inválido."
    );
  }
  return {
    iv: raw.subarray(0, IV_LENGTH),
    tag: raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH),
    encrypted: raw.subarray(IV_LENGTH + TAG_LENGTH)
  };
}

/** Cifra texto UTF-8 (Client ID/Secret, Pix key, webhook secret). */
export function encryptEfiSecret(plainText: string): string {
  if (typeof plainText !== "string" || plainText.length === 0) {
    throw new AppError(
      "ERR_EFI_CREDENTIAL_ENCRYPT_EMPTY",
      400,
      "Valor secreto Efí vazio."
    );
  }
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final()
  ]);
  return packCiphertext(iv, cipher.getAuthTag(), encrypted);
}

export function decryptEfiSecret(stored: string): string {
  const { iv, tag, encrypted } = unpackCiphertext(stored);
  try {
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new AppError(
      "ERR_EFI_CREDENTIAL_DECRYPT_FAILED",
      500,
      "Falha ao descriptografar credencial Efí."
    );
  }
}

/** Cifra bytes (PKCS#12). */
export function encryptEfiBinary(plain: Buffer): string {
  if (!Buffer.isBuffer(plain) || plain.length === 0) {
    throw new AppError(
      "ERR_EFI_CREDENTIAL_ENCRYPT_EMPTY",
      400,
      "Certificado Efí vazio."
    );
  }
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return packCiphertext(iv, cipher.getAuthTag(), encrypted);
}

export function decryptEfiBinary(stored: string): Buffer {
  const { iv, tag, encrypted } = unpackCiphertext(stored);
  try {
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw new AppError(
      "ERR_EFI_CREDENTIAL_DECRYPT_FAILED",
      500,
      "Falha ao descriptografar certificado Efí."
    );
  }
}

/** Máscara segura para DTOs (nunca o valor completo). */
export function maskEfiSecret(value: string, visibleTail = 4): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= visibleTail) {
    return "****";
  }
  return `${"*".repeat(Math.min(8, trimmed.length - visibleTail))}${trimmed.slice(
    -visibleTail
  )}`;
}

export function assertEfiEncryptionKeyConfigured(): void {
  resolveEncryptionSecret();
}
