import crypto from "crypto";
import type PlatformEfiConfig from "../../models/PlatformEfiConfig";

/**
 * `configFingerprint` (D-P2) — identifica a configuração exata que foi homologada.
 *
 * Entra: slot, ambiente, máscaras, fingerprint do P12 e o hash do ciphertext de cada
 * coluna cifrada. Nunca entra segredo em claro: hash do texto puro de uma chave Pix
 * (CPF, e-mail) seria reversível por força bruta.
 * Consequência: qualquer regravação de segredo ou P12 muda o fingerprint (inclusive
 * uma recifragem futura, D-P13), o que invalida a homologação, como exige D-P2.
 */
export type EfiFingerprintSource = Pick<
  PlatformEfiConfig,
  | "slot"
  | "efiEnvironment"
  | "clientIdMasked"
  | "pixKeyMasked"
  | "certificateFingerprint"
  | "clientIdEncrypted"
  | "clientSecretEncrypted"
  | "pixKeyEncrypted"
  | "webhookSecretEncrypted"
  | "cobrancasClientIdEncrypted"
  | "cobrancasClientSecretEncrypted"
  | "certificateEncrypted"
>;

const sha256 = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

const cipherVersion = (value: string | null | undefined): string | null =>
  value ? sha256(value) : null;

export function computeEfiConfigFingerprint(row: EfiFingerprintSource): string {
  const material = {
    v: 1,
    slot: row.slot,
    efiEnvironment: row.efiEnvironment,
    clientIdMasked: row.clientIdMasked ?? null,
    pixKeyMasked: row.pixKeyMasked ?? null,
    certificateFingerprint: row.certificateFingerprint ?? null,
    secrets: [
      row.clientIdEncrypted,
      row.clientSecretEncrypted,
      row.pixKeyEncrypted,
      row.webhookSecretEncrypted,
      row.cobrancasClientIdEncrypted,
      row.cobrancasClientSecretEncrypted,
      row.certificateEncrypted
    ].map(cipherVersion)
  };
  return sha256(JSON.stringify(material));
}
