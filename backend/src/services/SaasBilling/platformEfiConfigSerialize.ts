import {
  getAllowedEfiApiEnvironment,
  getAllowedEfiSlotForRuntime,
  getPermittedEfiApiEnvironments,
  getStreamhubRuntimeEnv,
  isEfiProductionApiAllowedInTestRuntime,
  tryGetStreamhubRuntimeEnv
} from "../../config/streamhubRuntimeEnv";
import PlatformEfiConfig, {
  PlatformEfiConfigStatus,
  PlatformEfiSlot
} from "../../models/PlatformEfiConfig";

function hasEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("efic1:") && value.length > 10;
}

export type EfiAdminDiagnosticState =
  | "runtime_invalid"
  | "empty"
  | "incomplete"
  | "configured"
  | "auth_validated"
  | "admin_enabled_awaiting_pix"
  | "pix_operational"
  | "revoked";

export function computeDiagnosticState(
  row: PlatformEfiConfig | null,
  runtimeValid: boolean
): EfiAdminDiagnosticState {
  if (!runtimeValid) return "runtime_invalid";
  if (!row) return "empty";
  if (row.status === "revoked") return "revoked";

  const hasIds =
    hasEncrypted(row.clientIdEncrypted) &&
    hasEncrypted(row.clientSecretEncrypted);
  if (!hasIds) {
    const anything =
      hasEncrypted(row.clientIdEncrypted) ||
      hasEncrypted(row.clientSecretEncrypted) ||
      hasEncrypted(row.certificateEncrypted) ||
      row.webhookSecretConfigured ||
      hasEncrypted(row.pixKeyEncrypted);
    return anything ? "incomplete" : "empty";
  }

  if (row.pixHomologated && row.adminEnabled) {
    return "pix_operational";
  }
  if (row.adminEnabled) {
    return "admin_enabled_awaiting_pix";
  }
  if (row.lastAuthTestOk === true) {
    return "auth_validated";
  }
  return "configured";
}

export type PlatformEfiConfigPublicDto = {
  runtime: {
    value: "test" | "production" | null;
    valid: boolean;
    label: string;
  };
  slot: PlatformEfiSlot | null;
  allowedSlot: PlatformEfiSlot | null;
  efiEnvironment: "sandbox" | "production" | null;
  efiEnvironmentLabel: string | null;
  /** B34-T10: ambientes aceitos neste runtime e alerta de conta Efí real em TESTE. */
  efiApi: {
    productionAllowedInTestRuntime: boolean;
    permittedEnvironments: Array<"sandbox" | "production">;
    /** false = slot gravado com ambiente não aceito agora (ex.: autorização removida); uso bloqueado. */
    environmentPermitted: boolean;
    realMoneyWarning: string | null;
  };
  status: PlatformEfiConfigStatus | null;
  diagnosticState: EfiAdminDiagnosticState;
  adminEnabled: boolean;
  pixHomologated: boolean;
  /** Sempre false na B2 até homologação Pix — OAuth não muda isto. */
  pixOperational: boolean;
  checkoutUsesLegacyEnv: true;
  credentials: {
    clientIdConfigured: boolean;
    clientIdMasked: string | null;
    clientSecretConfigured: boolean;
    pixKeyConfigured: boolean;
    pixKeyMasked: string | null;
    webhookSecretConfigured: boolean;
    cobrancasClientIdConfigured: boolean;
    cobrancasClientIdMasked: string | null;
    cobrancasClientSecretConfigured: boolean;
  };
  certificate: {
    configured: boolean;
    fingerprint: string | null;
    uploadedAt: string | null;
    friendlyName: string | null;
  };
  webhook: {
    secretConfigured: boolean;
    callbackPath: string;
    callbackBaseConfigured: boolean;
    registrationPending: true;
    note: string;
  };
  lastAuthTest: {
    at: string | null;
    ok: boolean | null;
    message: string | null;
    pixValidated: false;
  };
  activatedAt: string | null;
  updatedAt: string | null;
};

export function serializePlatformEfiConfig(
  row: PlatformEfiConfig | null,
  opts?: { slot?: PlatformEfiSlot }
): PlatformEfiConfigPublicDto {
  const runtimeRaw = tryGetStreamhubRuntimeEnv();
  const runtimeValid = runtimeRaw !== null;
  let allowedSlot: PlatformEfiSlot | null = null;
  let efiEnvExpected: "sandbox" | "production" | null = null;
  if (runtimeValid) {
    allowedSlot = getAllowedEfiSlotForRuntime(runtimeRaw);
    efiEnvExpected = getAllowedEfiApiEnvironment(runtimeRaw);
  }

  const slot = row?.slot ?? opts?.slot ?? allowedSlot;
  const permittedEnvironments = runtimeValid
    ? getPermittedEfiApiEnvironments(runtimeRaw)
    : [];
  const efiEnvironment = row?.efiEnvironment ?? efiEnvExpected;
  const diagnosticState = computeDiagnosticState(row, runtimeValid);

  const backendUrl = (process.env.BACKEND_URL || "").replace(/\/$/, "");

  return {
    runtime: {
      value: runtimeRaw,
      valid: runtimeValid,
      label:
        runtimeRaw === "test"
          ? "TESTE"
          : runtimeRaw === "production"
          ? "PRODUÇÃO"
          : "NÃO CONFIGURADO"
    },
    slot,
    allowedSlot,
    efiEnvironment,
    efiEnvironmentLabel:
      efiEnvironment === "sandbox"
        ? "HOMOLOGAÇÃO"
        : efiEnvironment === "production"
        ? "PRODUÇÃO"
        : null,
    efiApi: {
      productionAllowedInTestRuntime:
        runtimeRaw === "test" && isEfiProductionApiAllowedInTestRuntime(),
      permittedEnvironments,
      environmentPermitted:
        !efiEnvironment || permittedEnvironments.includes(efiEnvironment),
      realMoneyWarning:
        runtimeRaw === "test" && efiEnvironment === "production"
          ? "ATENÇÃO: conta Efí de PRODUÇÃO utilizada na VPS de TESTE. Operações financeiras podem movimentar dinheiro real."
          : null
    },
    status: row?.status ?? null,
    diagnosticState,
    adminEnabled: Boolean(row?.adminEnabled),
    pixHomologated: Boolean(row?.pixHomologated),
    pixOperational: Boolean(row?.pixHomologated && row?.adminEnabled),
    checkoutUsesLegacyEnv: true,
    credentials: {
      clientIdConfigured: hasEncrypted(row?.clientIdEncrypted),
      clientIdMasked: row?.clientIdMasked ?? null,
      clientSecretConfigured: hasEncrypted(row?.clientSecretEncrypted),
      pixKeyConfigured: hasEncrypted(row?.pixKeyEncrypted),
      pixKeyMasked: row?.pixKeyMasked ?? null,
      webhookSecretConfigured: Boolean(row?.webhookSecretConfigured),
      cobrancasClientIdConfigured: hasEncrypted(row?.cobrancasClientIdEncrypted),
      cobrancasClientIdMasked: row?.cobrancasClientIdMasked ?? null,
      cobrancasClientSecretConfigured: hasEncrypted(
        row?.cobrancasClientSecretEncrypted
      )
    },
    certificate: {
      configured: hasEncrypted(row?.certificateEncrypted),
      fingerprint: row?.certificateFingerprint ?? null,
      uploadedAt: row?.certificateUploadedAt
        ? new Date(row.certificateUploadedAt).toISOString()
        : null,
      friendlyName: row?.certificateFingerprint
        ? `Certificado P12 (${row.certificateFingerprint.slice(0, 12)}…)`
        : null
    },
    webhook: {
      secretConfigured: Boolean(row?.webhookSecretConfigured),
      callbackPath: "/subscription/webhook",
      callbackBaseConfigured: Boolean(backendUrl),
      registrationPending: true,
      note:
        "Secret interno da aplicação (token na URL/Bearer). Registro na Efí e cutover do webhook legado ficam para a fase 8.3-B3. Não chame a API Efí nesta tela."
    },
    lastAuthTest: {
      at: row?.lastAuthTestAt
        ? new Date(row.lastAuthTestAt).toISOString()
        : null,
      ok: row?.lastAuthTestOk ?? null,
      message: row?.lastAuthTestMessage ?? null,
      pixValidated: false
    },
    activatedAt: row?.activatedAt
      ? new Date(row.activatedAt).toISOString()
      : null,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null
  };
}

/** Garante runtime válido antes de mutações. */
export function assertRuntimeReadyForEfiAdmin(): {
  runtime: "test" | "production";
  slot: PlatformEfiSlot;
  efiEnvironment: "sandbox" | "production";
} {
  const runtime = getStreamhubRuntimeEnv();
  return {
    runtime,
    slot: getAllowedEfiSlotForRuntime(runtime),
    efiEnvironment: getAllowedEfiApiEnvironment(runtime)
  };
}
