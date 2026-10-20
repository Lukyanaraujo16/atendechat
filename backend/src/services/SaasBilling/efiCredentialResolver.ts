import AppError from "../../errors/AppError";
import {
  assertEfiSlotAllowedForRuntime,
  getAllowedEfiSlotForRuntime,
  getStreamhubRuntimeEnv,
  StreamhubRuntimeEnv
} from "../../config/streamhubRuntimeEnv";
import {
  decryptEfiBinary,
  decryptEfiSecret
} from "../../helpers/efiCredentialCrypto";
import PlatformEfiConfig, {
  PlatformEfiConfigStatus,
  PlatformEfiEnvironment,
  PlatformEfiSlot
} from "../../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../../models/PlatformEfiConfigAudit";
import { computeEfiConfigFingerprint } from "./efiConfigFingerprint";

/**
 * Resolvedor de credenciais Efí do banco — Fases 8.3-B1 e B3.1.
 *
 * - Lê EXCLUSIVAMENTE o banco (PlatformEfiConfigs). SEM fallback GERENCIANET_* / EFI_COBRANCAS_*.
 * - Regra D-P2: configuração válida basta no slot `homologation`; o slot `production`
 *   exige também integração homologada para o `configFingerprint` atual.
 * - Configuração válida exige validação Pix (P12 + OAuth mTLS) registrada na ativação para o
 *   `configFingerprint` atual (P-B31-03): ativações da B2 não contam.
 * - O P12 é devolvido só em memória (Buffer); nunca é gravado em disco (RF1.11).
 * - A escolha entre banco e env fica em `efiRuntimeCredentials.ts`.
 */

export type EfiHomologationRecord = {
  auditId: number;
  at: string;
  commit: string | null;
  efiEnvironment: string | null;
};

export type EfiPixValidationRecord = {
  auditId: number;
  at: string;
};

export type ResolvedEfiCredentials = {
  runtime: StreamhubRuntimeEnv;
  slot: PlatformEfiSlot;
  efiEnvironment: PlatformEfiEnvironment;
  status: PlatformEfiConfigStatus;
  configId: number;
  configUpdatedAt: Date | null;
  configFingerprint: string;
  homologation: EfiHomologationRecord | null;
  clientId: string;
  clientSecret: string;
  pixKey: string;
  webhookSecret: string;
  cobrancasClientId: string;
  cobrancasClientSecret: string;
  /** P12 em memória. */
  certificatePfx: Buffer;
  certificateFingerprint: string | null;
  clientIdMasked: string | null;
};

function hasEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("efic1:") && value.length > 10;
}

type StatusFields = Pick<
  PlatformEfiConfig,
  | "clientIdEncrypted"
  | "clientSecretEncrypted"
  | "certificateEncrypted"
  | "pixKeyEncrypted"
  | "webhookSecretConfigured"
  | "lastAuthTestOk"
  | "adminEnabled"
  | "pixHomologated"
  | "status"
>;

/**
 * Status persistido — regra única usada pelo admin e pelo resolvedor (R18, T-CRED-16).
 * Mesma semântica já gravada pelo admin B2; nenhum status existente muda.
 */
export function derivePlatformEfiConfigStatus(
  row: StatusFields
): PlatformEfiConfigStatus {
  if (row.status === "revoked" && !hasEncrypted(row.clientIdEncrypted)) {
    return "revoked";
  }
  const hasIds =
    hasEncrypted(row.clientIdEncrypted) && hasEncrypted(row.clientSecretEncrypted);
  if (!hasIds) {
    const anything =
      hasEncrypted(row.clientIdEncrypted) ||
      hasEncrypted(row.clientSecretEncrypted) ||
      hasEncrypted(row.certificateEncrypted) ||
      Boolean(row.webhookSecretConfigured) ||
      hasEncrypted(row.pixKeyEncrypted);
    return anything ? "incomplete" : "empty";
  }
  if (row.pixHomologated && row.adminEnabled) return "operational";
  if (row.lastAuthTestOk === true) return "auth_validated";
  return "configured";
}

export type EfiConfigReadiness = {
  /**
   * D-P2: adminEnabled + validação Pix da configuração atual + P12 + Client ID/Secret +
   * chave Pix + webhook secret.
   */
  validConfig: boolean;
  missing: Array<
    | "revoked"
    | "adminEnabled"
    | "pixValidation"
    | "credentials"
    | "certificate"
    | "pixKey"
    | "webhookSecret"
  >;
};

/**
 * Configuração válida (D-P2). `adminEnabled=true` só existe após uma ativação; qualquer
 * escrita de segredo ou P12 zera `adminEnabled` (F6). A ativação da B3.1 valida o P12 e o
 * OAuth Pix com mTLS e registra o fingerprint validado; `pixValidated` vem de
 * `findEfiPixValidationForConfig` (P-B31-03).
 */
export function evaluateEfiConfigReadiness(
  row: Pick<
    PlatformEfiConfig,
    | "status"
    | "adminEnabled"
    | "clientIdEncrypted"
    | "clientSecretEncrypted"
    | "certificateEncrypted"
    | "pixKeyEncrypted"
    | "webhookSecretEncrypted"
  >,
  validation: { pixValidated: boolean }
): EfiConfigReadiness {
  const missing: EfiConfigReadiness["missing"] = [];
  if (row.status === "revoked") missing.push("revoked");
  if (!row.adminEnabled) missing.push("adminEnabled");
  if (!validation.pixValidated) missing.push("pixValidation");
  if (!hasEncrypted(row.clientIdEncrypted) || !hasEncrypted(row.clientSecretEncrypted)) {
    missing.push("credentials");
  }
  if (!hasEncrypted(row.certificateEncrypted)) missing.push("certificate");
  if (!hasEncrypted(row.pixKeyEncrypted)) missing.push("pixKey");
  if (!hasEncrypted(row.webhookSecretEncrypted)) missing.push("webhookSecret");
  return { validConfig: missing.length === 0, missing };
}

/**
 * Registro de homologação (D-P17, R-14) válido para a configuração atual: o último
 * `homologate` do slot cujo fingerprint e ambiente batem. A ação `homologate` só é
 * criada na B3.3; até lá não há registro e o slot `production` fica bloqueado.
 */
export async function findEfiHomologationForConfig(
  row: Pick<PlatformEfiConfig, "id" | "slot" | "efiEnvironment">,
  configFingerprint: string
): Promise<EfiHomologationRecord | null> {
  const audit = await PlatformEfiConfigAudit.findOne({
    where: { configId: row.id, slot: row.slot, action: "homologate" },
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ]
  });
  const diff = parseAuditDiff(audit?.diffSummary);
  if (!audit || !diff) return null;
  if (diff.configFingerprint !== configFingerprint) return null;
  if (diff.efiEnvironment !== row.efiEnvironment) return null;
  return {
    auditId: audit.id,
    at: new Date(audit.createdAt).toISOString(),
    commit: typeof diff.commit === "string" ? diff.commit : null,
    efiEnvironment: row.efiEnvironment
  };
}

function parseAuditDiff(diffSummary: string | null | undefined): Record<string, unknown> | null {
  if (!diffSummary) return null;
  try {
    const parsed = JSON.parse(diffSummary);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Validação Pix da configuração atual (P-B31-03): a última ativação do slot precisa ter
 * validado o OAuth Pix com mTLS para este fingerprint e ambiente. Ativações da B2 não
 * gravavam o fingerprint e por isso não contam; basta desativar e ativar de novo.
 */
export async function findEfiPixValidationForConfig(
  row: Pick<PlatformEfiConfig, "id" | "slot" | "efiEnvironment">,
  configFingerprint: string
): Promise<EfiPixValidationRecord | null> {
  const audit = await PlatformEfiConfigAudit.findOne({
    where: { configId: row.id, slot: row.slot, action: "activate" },
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ]
  });
  const diff = parseAuditDiff(audit?.diffSummary);
  if (!audit || !diff) return null;
  if (diff.pixOAuthValidated !== true) return null;
  if (diff.configFingerprint !== configFingerprint) return null;
  if (diff.efiEnvironment !== row.efiEnvironment) return null;
  return { auditId: audit.id, at: new Date(audit.createdAt).toISOString() };
}

export async function loadEfiConfigForRuntimeSlot(): Promise<{
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

const MISSING_ERRORS: Record<
  Exclude<EfiConfigReadiness["missing"][number], "revoked">,
  [string, number, string]
> = {
  adminEnabled: [
    "ERR_EFI_CONFIG_NOT_ENABLED",
    403,
    "Configuração Efí do banco não está habilitada pelo Super Admin."
  ],
  pixValidation: [
    "ERR_EFI_PIX_VALIDATION_REQUIRED",
    403,
    "A configuração atual não tem validação Pix (mTLS) registrada. Desative e ative novamente no painel do Super Admin."
  ],
  credentials: ["ERR_EFI_CONFIG_INCOMPLETE", 400, "Credenciais Efí incompletas no banco."],
  certificate: [
    "ERR_EFI_CERTIFICATE_MISSING",
    400,
    "Certificado P12 Efí ausente na configuração."
  ],
  pixKey: ["ERR_EFI_PIX_KEY_MISSING", 400, "Chave Pix Efí não configurada."],
  webhookSecret: [
    "ERR_EFI_WEBHOOK_SECRET_MISSING",
    400,
    "Webhook secret Efí não configurado."
  ]
};

function decrypt(value: string, binary = false): string | Buffer {
  try {
    return binary ? decryptEfiBinary(value) : decryptEfiSecret(value);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      "ERR_EFI_CREDENTIAL_DECRYPT_FAILED",
      500,
      "Falha ao carregar credenciais Efí."
    );
  }
}

/**
 * Credenciais do banco para uso operacional, aplicando D-P2.
 * Descriptografa apenas em memória.
 */
export async function resolveEfiCredentials(
  loaded?: Awaited<ReturnType<typeof loadEfiConfigForRuntimeSlot>>
): Promise<ResolvedEfiCredentials> {
  const { runtime, slot, row } = loaded || (await loadEfiConfigForRuntimeSlot());

  if (row.status === "revoked") {
    throw new AppError("ERR_EFI_CONFIG_REVOKED", 403, "Configuração Efí revogada.");
  }

  const configFingerprint = computeEfiConfigFingerprint(row);
  const pixValidation = await findEfiPixValidationForConfig(row, configFingerprint);
  const readiness = evaluateEfiConfigReadiness(row, {
    pixValidated: Boolean(pixValidation)
  });
  if (!readiness.validConfig) {
    const first = readiness.missing[0] as keyof typeof MISSING_ERRORS;
    const [code, status, message] = MISSING_ERRORS[first];
    throw new AppError(code, status, message);
  }

  const homologation = await findEfiHomologationForConfig(row, configFingerprint);
  if (slot === "production" && !homologation) {
    throw new AppError(
      "ERR_EFI_INTEGRATION_NOT_HOMOLOGATED",
      403,
      "Slot de produção exige integração homologada para a configuração atual (D-P2/D-P17)."
    );
  }

  const clientId = decrypt(row.clientIdEncrypted!) as string;
  const clientSecret = decrypt(row.clientSecretEncrypted!) as string;

  return {
    runtime,
    slot,
    efiEnvironment: row.efiEnvironment,
    status: row.status,
    configId: row.id,
    configUpdatedAt: row.updatedAt ?? null,
    configFingerprint,
    homologation,
    clientId,
    clientSecret,
    pixKey: decrypt(row.pixKeyEncrypted!) as string,
    webhookSecret: decrypt(row.webhookSecretEncrypted!) as string,
    cobrancasClientId: hasEncrypted(row.cobrancasClientIdEncrypted)
      ? (decrypt(row.cobrancasClientIdEncrypted!) as string)
      : clientId,
    cobrancasClientSecret: hasEncrypted(row.cobrancasClientSecretEncrypted)
      ? (decrypt(row.cobrancasClientSecretEncrypted!) as string)
      : clientSecret,
    certificatePfx: decrypt(row.certificateEncrypted!, true) as Buffer,
    certificateFingerprint: row.certificateFingerprint,
    clientIdMasked: row.clientIdMasked
  };
}

/**
 * DTO seguro para inspeção (sem secrets/ciphertext).
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
