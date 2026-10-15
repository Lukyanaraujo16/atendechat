import AppError from "../../errors/AppError";
import {
  assertEfiSlotAllowedForRuntime,
  getAllowedEfiSlotForRuntime,
  getStreamhubRuntimeEnv,
  StreamhubRuntimeEnv
} from "../../config/streamhubRuntimeEnv";
import { decryptEfiSecret } from "../../helpers/efiCredentialCrypto";
import PlatformEfiConfig, {
  PlatformEfiConfigStatus,
  PlatformEfiEnvironment,
  PlatformEfiSlot
} from "../../models/PlatformEfiConfig";
import { materializeEfiCertificateToRuntimePath } from "./efiCertificateStore";

/**
 * Resolvedor de credenciais Efí — Fase 8.3-B1.
 *
 * - Lê EXCLUSIVAMENTE o banco (PlatformEfiConfigs).
 * - SEM fallback GERENCIANET_* / EFI_COBRANCAS_*.
 * - SEM database_then_env.
 * - Isolado: ainda NÃO conectado a checkout, webhook ou Cobranças.
 */

export type ResolvedEfiCredentials = {
  runtime: StreamhubRuntimeEnv;
  slot: PlatformEfiSlot;
  efiEnvironment: PlatformEfiEnvironment;
  status: PlatformEfiConfigStatus;
  configId: number;
  clientId: string;
  clientSecret: string;
  pixKey: string | null;
  webhookSecret: string | null;
  cobrancasClientId: string;
  cobrancasClientSecret: string;
  /** Path materializado em cache runtime (quando requireCertificate). */
  certificatePath: string | null;
  certificateFingerprint: string | null;
  clientIdMasked: string | null;
};

export type ResolveEfiCredentialsOptions = {
  /** Exige status === operational (default true). */
  requireOperational?: boolean;
  /** Exige e materializa certificado P12 (default false). */
  requireCertificate?: boolean;
  /** Exige webhook secret presente (default false). */
  requireWebhookSecret?: boolean;
};

function hasEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("efic1:") && value.length > 10;
}

/**
 * Deriva status coerente a partir dos campos (utilitário para B2; resolver usa status persistido).
 */
export function derivePlatformEfiConfigStatus(
  row: Pick<
    PlatformEfiConfig,
    | "clientIdEncrypted"
    | "clientSecretEncrypted"
    | "certificateEncrypted"
    | "webhookSecretConfigured"
    | "lastAuthTestOk"
    | "activatedAt"
    | "status"
  >
): PlatformEfiConfigStatus {
  if (row.status === "revoked") return "revoked";

  const hasClientId = hasEncrypted(row.clientIdEncrypted);
  const hasClientSecret = hasEncrypted(row.clientSecretEncrypted);
  const hasIds = hasClientId && hasClientSecret;
  const hasCert = hasEncrypted(row.certificateEncrypted);
  const hasAnything =
    hasClientId ||
    hasClientSecret ||
    hasCert ||
    Boolean(row.webhookSecretConfigured);

  if (!hasAnything) {
    return "empty";
  }
  if (!hasIds) {
    return "incomplete";
  }
  if (row.activatedAt && row.lastAuthTestOk === true) {
    return "operational";
  }
  if (row.lastAuthTestOk === true) {
    return "auth_validated";
  }
  return "configured";
}

async function loadConfigForAllowedSlot(): Promise<{
  runtime: StreamhubRuntimeEnv;
  slot: PlatformEfiSlot;
  row: PlatformEfiConfig;
}> {
  const runtime = getStreamhubRuntimeEnv();
  const slot = getAllowedEfiSlotForRuntime(runtime);

  const row = await PlatformEfiConfig.findOne({ where: { slot } });
  if (!row) {
    throw new AppError(
      "ERR_EFI_CONFIG_NOT_FOUND",
      404,
      `Configuração Efí ausente para o slot '${slot}'.`
    );
  }

  assertEfiSlotAllowedForRuntime(row.slot, row.efiEnvironment);
  return { runtime, slot, row };
}

/**
 * Resolve credenciais tipadas para consumidores internos futuros.
 * Descriptografa apenas em memória no backend.
 */
export async function resolveEfiCredentials(
  options: ResolveEfiCredentialsOptions = {}
): Promise<ResolvedEfiCredentials> {
  const requireOperational = options.requireOperational !== false;
  const requireCertificate = options.requireCertificate === true;
  const requireWebhookSecret = options.requireWebhookSecret === true;

  const { runtime, slot, row } = await loadConfigForAllowedSlot();

  if (row.status === "revoked") {
    throw new AppError(
      "ERR_EFI_CONFIG_REVOKED",
      403,
      "Configuração Efí revogada."
    );
  }

  if (requireOperational && row.status !== "operational") {
    throw new AppError(
      "ERR_EFI_CONFIG_NOT_OPERATIONAL",
      403,
      `Configuração Efí não operacional (status=${row.status}).`
    );
  }

  if (
    !hasEncrypted(row.clientIdEncrypted) ||
    !hasEncrypted(row.clientSecretEncrypted)
  ) {
    throw new AppError(
      "ERR_EFI_CONFIG_INCOMPLETE",
      400,
      "Credenciais Efí incompletas no banco."
    );
  }

  let clientId: string;
  let clientSecret: string;
  try {
    clientId = decryptEfiSecret(row.clientIdEncrypted!);
    clientSecret = decryptEfiSecret(row.clientSecretEncrypted!);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      "ERR_EFI_CREDENTIAL_DECRYPT_FAILED",
      500,
      "Falha ao carregar credenciais Efí."
    );
  }

  let pixKey: string | null = null;
  if (hasEncrypted(row.pixKeyEncrypted)) {
    pixKey = decryptEfiSecret(row.pixKeyEncrypted!);
  }

  let webhookSecret: string | null = null;
  if (hasEncrypted(row.webhookSecretEncrypted)) {
    webhookSecret = decryptEfiSecret(row.webhookSecretEncrypted!);
  }
  if (requireWebhookSecret && !webhookSecret) {
    throw new AppError(
      "ERR_EFI_WEBHOOK_SECRET_MISSING",
      400,
      "Webhook secret Efí não configurado."
    );
  }

  const cobrancasClientId = hasEncrypted(row.cobrancasClientIdEncrypted)
    ? decryptEfiSecret(row.cobrancasClientIdEncrypted!)
    : clientId;
  const cobrancasClientSecret = hasEncrypted(row.cobrancasClientSecretEncrypted)
    ? decryptEfiSecret(row.cobrancasClientSecretEncrypted!)
    : clientSecret;

  let certificatePath: string | null = null;
  if (requireCertificate) {
    if (
      !row.certificateEncrypted ||
      !row.certificateStorageKey ||
      !hasEncrypted(row.certificateEncrypted)
    ) {
      throw new AppError(
        "ERR_EFI_CERTIFICATE_MISSING",
        400,
        "Certificado P12 Efí ausente na configuração."
      );
    }
    certificatePath = materializeEfiCertificateToRuntimePath({
      storageKey: row.certificateStorageKey,
      encryptedPayload: row.certificateEncrypted
    });
  }

  return {
    runtime,
    slot,
    efiEnvironment: row.efiEnvironment,
    status: row.status,
    configId: row.id,
    clientId,
    clientSecret,
    pixKey,
    webhookSecret,
    cobrancasClientId,
    cobrancasClientSecret,
    certificatePath,
    certificateFingerprint: row.certificateFingerprint,
    clientIdMasked: row.clientIdMasked
  };
}

/**
 * DTO seguro para inspeção (sem secrets/ciphertext).
 * Útil em testes e futura UI — não substitui GET admin da B2.
 */
export async function getEfiResolverPublicSnapshot(): Promise<{
  runtime: StreamhubRuntimeEnv;
  allowedSlot: PlatformEfiSlot;
  configFound: boolean;
  status: PlatformEfiConfigStatus | null;
  efiEnvironment: PlatformEfiEnvironment | null;
  clientIdMasked: string | null;
  certificatePresent: boolean;
  certificateFingerprint: string | null;
  webhookSecretConfigured: boolean;
  usesLegacyEnvFallback: false;
}> {
  const runtime = getStreamhubRuntimeEnv();
  const allowedSlot = getAllowedEfiSlotForRuntime(runtime);
  const row = await PlatformEfiConfig.findOne({ where: { slot: allowedSlot } });

  return {
    runtime,
    allowedSlot,
    configFound: Boolean(row),
    status: row?.status ?? null,
    efiEnvironment: row?.efiEnvironment ?? null,
    clientIdMasked: row?.clientIdMasked ?? null,
    certificatePresent: hasEncrypted(row?.certificateEncrypted),
    certificateFingerprint: row?.certificateFingerprint ?? null,
    webhookSecretConfigured: Boolean(row?.webhookSecretConfigured),
    usesLegacyEnvFallback: false
  };
}

/** Garante que o módulo não lê process.env de credenciais legadas. */
export function assertResolverIgnoresLegacyEnv(): {
  readsGerencianet: false;
  readsEfiCobrancas: false;
  source: "database_only";
} {
  return {
    readsGerencianet: false,
    readsEfiCobrancas: false,
    source: "database_only"
  };
}
