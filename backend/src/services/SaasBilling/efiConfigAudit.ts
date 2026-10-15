import PlatformEfiConfigAudit, {
  PlatformEfiAuditAction
} from "../../models/PlatformEfiConfigAudit";
import type { PlatformEfiSlot } from "../../models/PlatformEfiConfig";

const FORBIDDEN_DIFF_KEYS = [
  "clientId",
  "clientSecret",
  "clientIdEncrypted",
  "clientSecretEncrypted",
  "pixKey",
  "pixKeyEncrypted",
  "webhookSecret",
  "webhookSecretEncrypted",
  "cobrancasClientId",
  "cobrancasClientSecret",
  "cobrancasClientIdEncrypted",
  "cobrancasClientSecretEncrypted",
  "certificateEncrypted",
  "certificate",
  "p12",
  "secret",
  "password",
  "token"
];

/**
 * Remove chaves sensíveis de um resumo de auditoria.
 * Nunca persiste secrets, ciphertext completo nem bytes de certificado.
 */
export function sanitizeEfiAuditDiff(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_DIFF_KEYS.some(f => lower.includes(f.toLowerCase()))) {
      if (
        lower.includes("masked") ||
        lower.includes("fingerprint") ||
        lower.includes("configured") ||
        lower.includes("present") ||
        lower.endsWith("rotated") ||
        lower.endsWith("changed")
      ) {
        // máscaras / flags booleanas ok
      } else {
        out[key] = "[redacted]";
        continue;
      }
    }
    if (typeof value === "string" && value.startsWith("efic1:")) {
      out[key] = "[redacted]";
      continue;
    }
    if (Buffer.isBuffer(value)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export type RecordEfiConfigAuditInput = {
  configId?: number | null;
  slot: PlatformEfiSlot;
  actorUserId?: number | null;
  action: PlatformEfiAuditAction;
  diffSummary?: Record<string, unknown> | null;
};

/**
 * Persiste evento de auditoria sem secrets.
 * Pronto para B2 (UI/endpoints); B1 só estrutura + helper.
 */
export async function recordEfiConfigAudit(
  input: RecordEfiConfigAuditInput
): Promise<PlatformEfiConfigAudit> {
  const safe = sanitizeEfiAuditDiff(input.diffSummary || {});
  return PlatformEfiConfigAudit.create({
    configId: input.configId ?? null,
    slot: input.slot,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    diffSummary: Object.keys(safe).length ? JSON.stringify(safe) : null
  });
}
