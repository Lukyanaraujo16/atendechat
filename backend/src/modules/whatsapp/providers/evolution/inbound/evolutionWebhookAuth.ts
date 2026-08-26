import crypto from "crypto";
import { decryptEvolutionApiKey } from "../../../../../helpers/evolutionCredentialCrypto";
import WhatsappEvolutionCredential from "../../../../../models/WhatsappEvolutionCredential";

function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Extrai apiKey do request Evolution.
 * Docs: header `apikey` e/ou campo body `apikey`.
 * Sem HMAC nativo no modo alvo — documentado na Fase 6.
 */
export function extractEvolutionWebhookApiKey(input: {
  headers: Record<string, unknown>;
  body: Record<string, unknown>;
}): string | null {
  const h = input.headers || {};
  const headerCandidates = [h.apikey, h.apiKey, h["x-api-key"], h["x-apikey"]];
  const fromHeader = headerCandidates.find(
    (c): c is string => typeof c === "string" && Boolean(c.trim())
  );
  if (fromHeader) return fromHeader.trim();
  const auth = h.authorization;
  if (typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  const bodyKey = input.body?.apikey ?? input.body?.apiKey;
  if (typeof bodyKey === "string" && bodyKey.trim()) return bodyKey.trim();
  return null;
}

export async function verifyEvolutionWebhookApiKey(input: {
  whatsappId: number;
  presentedKey: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!input.presentedKey) {
    return { ok: false, reason: "missing_apikey" };
  }

  const cred = await WhatsappEvolutionCredential.unscoped().findOne({
    where: { whatsappId: input.whatsappId },
    attributes: ["id", "apiKeyEncrypted"]
  });

  if (!cred?.apiKeyEncrypted) {
    return { ok: false, reason: "missing_credential" };
  }

  let plain: string;
  try {
    plain = decryptEvolutionApiKey(cred.apiKeyEncrypted);
  } catch {
    return { ok: false, reason: "decrypt_failed" };
  }

  if (!timingSafeEqualString(plain, input.presentedKey)) {
    return { ok: false, reason: "apikey_mismatch" };
  }

  return { ok: true };
}
