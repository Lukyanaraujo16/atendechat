import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import AppError from "../../errors/AppError";
import { encryptEfiBinary } from "../../helpers/efiCredentialCrypto";
import type { PlatformEfiSlot } from "../../models/PlatformEfiConfig";
import { assertEfiP12Opens } from "./efiPixClient";

/**
 * Armazenamento privado de certificados P12 (Fase 8.3-B1).
 *
 * DECISÃO DE INFRA (inspect deploy):
 * - docker-compose.yml monta apenas postgres_data e redis_data.
 * - copy_cert_assets.sh copia para /app/certs no start do container (não volume).
 * - Portanto NÃO há garantia de persistência de arquivo entre deploys/recreates.
 *
 * Fonte durável: blob cifrado no banco (certificateEncrypted).
 * Uso: decifrado só em memória (`efiPixClient`, B3.1). Sem materialização em disco.
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
 * Validação do PKCS#12 no upload (B3.1, T-CERT-03/RF1.8).
 * A heurística anterior (prefixo de OID `06 08 …`) rejeitava P12 reais, cujos OIDs
 * PKCS (ex.: 1.2.840.113549.1.7.1) têm 9 bytes. Agora o arquivo precisa abrir de fato.
 */
export function assertLooksLikePkcs12(buf: Buffer): void {
  if (buf.length < 64 || buf[0] !== 0x30) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_INVALID_TYPE",
      400,
      "Arquivo não parece um certificado PKCS#12 (.p12/.pfx) válido."
    );
  }
  assertEfiP12Opens(buf);
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
 * Remove, best-effort, P12 materializado em disco por versões anteriores (B1).
 * Desde a B3.1 nada grava o P12 em disco: o caminho `database` usa só memória (RF1.11).
 */
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
