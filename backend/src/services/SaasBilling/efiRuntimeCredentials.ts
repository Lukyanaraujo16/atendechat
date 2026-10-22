import crypto from "crypto";
import path from "path";
import AppError from "../../errors/AppError";
import {
  EfiCredentialsSource,
  getEfiActivationControls,
  saasBillingFlags
} from "../../config/saasBillingFlags";
import type {
  PlatformEfiEnvironment,
  PlatformEfiSlot
} from "../../models/PlatformEfiConfig";
import {
  loadEfiConfigForRuntimeSlot,
  resolveEfiCredentials
} from "./efiCredentialResolver";
import { invalidateEfiPixTokenCache } from "./efiPixClient";
import { getEfiFinancialCredentialsSource } from "./efiFinancialSource";

/**
 * Provedor único de credenciais Efí (R-1, D-P1) — Fase 8.3-B3.1.
 *
 * `EFI_CREDENTIALS_SOURCE=legacy_env` (default): as mesmas variáveis do fluxo atual
 * (`config/Gn.ts`, `efiCobrancasClient`). `database`: slot do runtime, regra D-P2, P12 em memória.
 * Sem fallback entre as fontes.
 *
 * B3.1 só entrega o provedor: checkout e webhook continuam lendo `config/Gn.ts` até a
 * B3.2/B3.3 (nenhum fluxo financeiro trocado). Por isso a finalidade `financial` segue
 * `getEfiFinancialCredentialsSource()` (hoje sempre `legacy_env`, P-B31-08); só a finalidade
 * `diagnostic` respeita `EFI_CREDENTIALS_SOURCE=database`.
 */
export type EfiRuntimeCertificate =
  | { kind: "memory"; pfx: Buffer }
  /** Caminho do P12 do legado (`certs/<GERENCIANET_PIX_CERT>.p12`), lido pelo SDK. */
  | { kind: "file"; path: string };

export type EfiRuntimeCredentials = {
  source: EfiCredentialsSource;
  efiEnvironment: PlatformEfiEnvironment;
  slot: PlatformEfiSlot | null;
  configId: number | null;
  configFingerprint: string | null;
  clientId: string;
  clientSecret: string;
  pixKey: string | null;
  webhookSecret: string | null;
  cobrancasClientId: string;
  cobrancasClientSecret: string;
  certificate: EfiRuntimeCertificate;
  /** Chave para caches de token OAuth: muda com a credencial e o ambiente. */
  tokenCacheKey: string;
};

const envValue = (key: string): string | null => {
  const v = (process.env[key] || "").trim();
  return v === "" ? null : v;
};

const shortHash = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);

function legacyEnvCredentials(): EfiRuntimeCredentials {
  const clientId = envValue("GERENCIANET_CLIENT_ID");
  const clientSecret = envValue("GERENCIANET_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new AppError(
      "ERR_EFI_LEGACY_ENV_INCOMPLETE",
      500,
      "GERENCIANET_CLIENT_ID/GERENCIANET_CLIENT_SECRET ausentes."
    );
  }
  const efiEnvironment: PlatformEfiEnvironment = saasBillingFlags.gerencianetSandbox()
    ? "sandbox"
    : "production";
  const cobrancasClientId = envValue("EFI_COBRANCAS_CLIENT_ID") || clientId;
  const cobrancasClientSecret = envValue("EFI_COBRANCAS_CLIENT_SECRET") || clientSecret;
  return {
    source: "legacy_env",
    efiEnvironment,
    slot: null,
    configId: null,
    configFingerprint: null,
    clientId,
    clientSecret,
    pixKey: envValue("GERENCIANET_PIX_KEY"),
    webhookSecret: envValue("WEBHOOK_SUBSCRIPTION_SECRET"),
    cobrancasClientId,
    cobrancasClientSecret,
    // Mesmo caminho de config/Gn.ts.
    certificate: {
      kind: "file",
      path: path.join(
        __dirname,
        `../../../certs/${process.env.GERENCIANET_PIX_CERT || ""}.p12`
      )
    },
    tokenCacheKey: `env:${efiEnvironment}:${shortHash(`${clientId}:${clientSecret}`)}`
  };
}

/** Cache por `configId:updatedAt` (RF1.5). Toda escrita admin muda `updatedAt` e também invalida. */
const databaseCache = new Map<string, EfiRuntimeCredentials>();

async function databaseCredentials(): Promise<EfiRuntimeCredentials> {
  const loaded = await loadEfiConfigForRuntimeSlot();
  const updatedAt = loaded.row.updatedAt ? new Date(loaded.row.updatedAt).getTime() : 0;
  const key = `db:${loaded.row.id}:${updatedAt}:${loaded.row.efiEnvironment}`;
  const hit = databaseCache.get(key);
  if (hit) return hit;

  const r = await resolveEfiCredentials(loaded);
  const creds: EfiRuntimeCredentials = {
    source: "database",
    efiEnvironment: r.efiEnvironment,
    slot: r.slot,
    configId: r.configId,
    configFingerprint: r.configFingerprint,
    clientId: r.clientId,
    clientSecret: r.clientSecret,
    pixKey: r.pixKey,
    webhookSecret: r.webhookSecret,
    cobrancasClientId: r.cobrancasClientId,
    cobrancasClientSecret: r.cobrancasClientSecret,
    certificate: { kind: "memory", pfx: r.certificatePfx },
    tokenCacheKey: key
  };
  databaseCache.clear();
  databaseCache.set(key, creds);
  return creds;
}

/** `database`: sempre o slot do banco, nunca `legacy_env` (consultas admin só leitura, B34-T10). */
export type EfiCredentialsPurpose = "financial" | "diagnostic" | "database";

export async function getEfiRuntimeCredentials(
  purpose: EfiCredentialsPurpose
): Promise<EfiRuntimeCredentials> {
  if (purpose === "database") return databaseCredentials();
  const source =
    purpose === "financial"
      ? getEfiFinancialCredentialsSource()
      : getEfiActivationControls().credentialsSource;
  return source === "database" ? databaseCredentials() : legacyEnvCredentials();
}

/**
 * Invalida credenciais e tokens Pix em cache. Chamado em toda ação admin
 * (upsert, upload, delete, ativação, desativação, revogação) e, a partir da B3.3, em `homologate`.
 * O token Cobranças é indexado por `tokenCacheKey`, que já muda com `updatedAt`.
 */
export function invalidateEfiRuntimeCredentialsCache(): void {
  databaseCache.clear();
  invalidateEfiPixTokenCache();
}
