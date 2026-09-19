import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Política SSRF compartilhada (Evolution inbound + mídia de automação).
 * Bloqueia localhost, IPs privados, metadata e protocolos não HTTP(S).
 */

const PRIVATE_IP_RE =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.|::1$|fc|fd|fe80)/i;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "169.254.169.254",
  "::1",
  "0.0.0.0"
]);

export type HttpUrlSafetyResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[(.*)\]$/, "$1");
}

export function isPrivateOrLocalHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return true;
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h === "metadata.google.internal") return true;
  if (PRIVATE_IP_RE.test(h)) return true;
  if (isIP(h) && PRIVATE_IP_RE.test(h)) return true;
  return false;
}

export { PRIVATE_IP_RE };

/**
 * URL HTTP(S) pública: não exige allowlist de host (Typebot CDN).
 * Continua bloqueando privado/local/metadata/file.
 */
export function assertSafePublicHttpUrl(
  candidateUrl: string
): HttpUrlSafetyResult {
  let candidate: URL;
  try {
    candidate = new URL(String(candidateUrl || "").trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (!["http:", "https:"].includes(candidate.protocol)) {
    return { ok: false, reason: "protocol_not_allowed" };
  }

  const candidateHost = normalizeHost(candidate.hostname);
  if (isPrivateOrLocalHost(candidateHost)) {
    return { ok: false, reason: "private_or_local_host" };
  }

  return { ok: true, url: candidate };
}

/** DNS resolve + bloqueio de IP privado (anti DNS-rebinding). */
export async function assertSafePublicHttpUrlResolved(
  candidateUrl: string
): Promise<HttpUrlSafetyResult> {
  const base = assertSafePublicHttpUrl(candidateUrl);
  if (base.ok === false) return base;

  try {
    const records = await lookup(base.url.hostname, { all: true });
    const blocked = records.find(
      r => isPrivateOrLocalHost(r.address) || PRIVATE_IP_RE.test(r.address)
    );
    if (blocked) {
      return { ok: false, reason: "resolved_private_ip" };
    }
  } catch {
    return { ok: false, reason: "dns_lookup_failed" };
  }

  return base;
}
