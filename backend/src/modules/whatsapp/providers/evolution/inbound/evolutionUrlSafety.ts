import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Proteção SSRF para URLs de mídia Evolution.
 *
 * Estratégia preferida: URL deve pertencer à baseUrl da credencial
 * (mesma origem Evolution). Hosts privados / metadata são bloqueados
 * mesmo se coincidirem com typos.
 */

const PRIVATE_IP_RE =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.|::1$|fc|fd|fe80)/i;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "169.254.169.254"
]);

export type EvolutionUrlSafetyResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

export function isPrivateOrLocalHost(host: string): boolean {
  const h = normalizeHost(host);
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h === "metadata.google.internal") return true;
  if (PRIVATE_IP_RE.test(h)) return true;
  if (isIP(h) && PRIVATE_IP_RE.test(h)) return true;
  return false;
}

/**
 * Valida URL HTTP(S) contra origem Evolution conhecida + bloqueios SSRF.
 */
export function assertSafeEvolutionMediaUrl(input: {
  candidateUrl: string;
  allowedBaseUrl: string;
}): EvolutionUrlSafetyResult {
  let candidate: URL;
  let allowed: URL;
  try {
    candidate = new URL(String(input.candidateUrl || "").trim());
    allowed = new URL(String(input.allowedBaseUrl || "").trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (!["http:", "https:"].includes(candidate.protocol)) {
    return { ok: false, reason: "protocol_not_allowed" };
  }

  const candidateHost = normalizeHost(candidate.hostname);
  const allowedHost = normalizeHost(allowed.hostname);

  if (isPrivateOrLocalHost(candidateHost)) {
    return { ok: false, reason: "private_or_local_host" };
  }

  if (candidateHost !== allowedHost) {
    return { ok: false, reason: "host_not_evolution_base" };
  }

  if (candidate.protocol !== allowed.protocol) {
    return { ok: false, reason: "protocol_mismatch_with_base" };
  }

  return { ok: true, url: candidate };
}

/** DNS resolve + bloqueio de IP privado (anti DNS-rebinding). */
export async function assertSafeEvolutionMediaUrlResolved(input: {
  candidateUrl: string;
  allowedBaseUrl: string;
}): Promise<EvolutionUrlSafetyResult> {
  const base = assertSafeEvolutionMediaUrl(input);
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
