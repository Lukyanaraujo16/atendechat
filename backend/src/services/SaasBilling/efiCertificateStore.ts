import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import AppError from "../../errors/AppError";
import {
  decryptEfiBinary,
  encryptEfiBinary
} from "../../helpers/efiCredentialCrypto";
import type { PlatformEfiSlot } from "../../models/PlatformEfiConfig";

/**
 * Armazenamento privado de certificados P12 (Fase 8.3-B1).
 *
 * DECISÃO DE INFRA (inspect deploy):
 * - docker-compose.yml monta apenas postgres_data e redis_data.
 * - copy_cert_assets.sh copia para /app/certs no start do container (não volume).
 * - Portanto NÃO há garantia de persistência de arquivo entre deploys/recreates.
 *
 * Fonte durável: blob cifrado no banco (certificateEncrypted).
 * Cache runtime: materialização em diretório privado (não público, não git),
 * apenas para consumidores futuros do SDK que exigem path de arquivo.
 *
 * BLOQUEIO: armazenamento filesystem-primary (ex.: só path em disco) NÃO é
 * suportado até existir volume persistente dedicado no deploy.
 */

export type EfiCertificatePersistResult = {
  storageKey: string;
  fingerprint: string;
  encryptedPayload: string;
};

export const MAX_P12_BYTES = 2 * 1024 * 1024;

/**
 * Validação estrutural PKCS#12 sem depender só de extensão/MIME.
 * - ASN.1 SEQUENCE (0x30)
 * - tamanho mínimo
 * - OID PKCS#12 / PKCS#7 comum (1.2.840.113549.1.12 ou .1.7)
 */
export function assertLooksLikePkcs12(buf: Buffer): void {
  if (buf.length < 64 || buf[0] !== 0x30) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_INVALID_TYPE",
      400,
      "Arquivo não parece um certificado PKCS#12 (.p12/.pfx) válido."
    );
  }
  // OID prefix 1.2.840.113549.1 → 06 08 2a 86 48 86 f7 0d 01
  const pkcsOidPrefix = Buffer.from([
    0x06, 0x08, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01
  ]);
  if (buf.indexOf(pkcsOidPrefix) < 0) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_INVALID_TYPE",
      400,
      "Estrutura PKCS#12/PKCS#7 não reconhecida no arquivo enviado."
    );
  }
}

export function fingerprintP12(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function buildEfiCertificateStorageKey(slot: PlatformEfiSlot): string {
  const id = crypto.randomBytes(16).toString("hex");
  return `efi-cert-${slot}-${id}`;
}

/**
 * Persiste certificado como ciphertext versionado (efic1:).
 * Não grava em disco como fonte da verdade.
 */
export function persistEfiCertificateEncrypted(
  slot: PlatformEfiSlot,
  buffer: Buffer
): EfiCertificatePersistResult {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_EMPTY",
      400,
      "Certificado P12 ausente."
    );
  }
  if (buffer.length > MAX_P12_BYTES) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_TOO_LARGE",
      400,
      "Certificado P12 excede o tamanho máximo permitido."
    );
  }
  assertLooksLikePkcs12(buffer);

  const storageKey = buildEfiCertificateStorageKey(slot);
  const fingerprint = fingerprintP12(buffer);
  const encryptedPayload = encryptEfiBinary(buffer);

  return { storageKey, fingerprint, encryptedPayload };
}

/**
 * Diretório de cache runtime — nunca sob public/.
 * Conteúdo é efêmero; redeploy pode limpar.
 */
export function getEfiCertificateRuntimeCacheDir(): string {
  const configured = process.env.EFI_CERT_RUNTIME_CACHE_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(os.tmpdir(), "streamhub-efi-certs");
}

/**
 * Materializa P12 descriptografado em path privado para uso futuro do SDK.
 * Não loga conteúdo. Permissões 0o700 / 0o600 quando possível.
 */
export function materializeEfiCertificateToRuntimePath(input: {
  storageKey: string;
  encryptedPayload: string;
}): string {
  if (!input.storageKey || !input.encryptedPayload) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_MISSING",
      400,
      "Certificado Efí não configurado."
    );
  }

  // Garante que a chave interna não escape path traversal
  if (
    input.storageKey.includes("..") ||
    input.storageKey.includes("/") ||
    input.storageKey.includes("\\")
  ) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_STORAGE_KEY_INVALID",
      500,
      "Chave interna de certificado inválida."
    );
  }

  const plain = decryptEfiBinary(input.encryptedPayload);
  const dir = getEfiCertificateRuntimeCacheDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Windows / FS sem chmod — segue
  }

  const abs = path.join(dir, `${input.storageKey}.p12`);
  fs.writeFileSync(abs, plain, { mode: 0o600 });
  try {
    fs.chmodSync(abs, 0o600);
  } catch {
    // ignore
  }

  // Limpa buffer local
  plain.fill(0);
  return abs;
}

export function revokeEfiCertificateRuntimeFile(storageKey: string | null): void {
  if (!storageKey) return;
  if (
    storageKey.includes("..") ||
    storageKey.includes("/") ||
    storageKey.includes("\\")
  ) {
    return;
  }
  const abs = path.join(getEfiCertificateRuntimeCacheDir(), `${storageKey}.p12`);
  try {
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  } catch {
    // best-effort
  }
}

/**
 * Indica se o deploy oferece volume de disco persistente para certs.
 * Hoje: false (documentado). Upload admin (B2) usa blob no DB.
 */
export function isFilesystemPrimaryCertStorageSupported(): boolean {
  return process.env.EFI_CERT_FILESYSTEM_PRIMARY === "true";
}
