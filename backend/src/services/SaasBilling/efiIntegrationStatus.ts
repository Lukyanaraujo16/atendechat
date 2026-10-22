import fs from "fs";
import path from "path";
import axios from "axios";
import {
  EfiActivationControls,
  getEfiActivationControls,
  saasBillingFlags
} from "../../config/saasBillingFlags";
import {
  AppBuildInfo,
  getAppBuildCommit,
  getAppBuildInfo,
  isSameAppCommit
} from "../../config/appBuildInfo";
import {
  getAllowedEfiSlotForRuntime,
  isEfiProductionApiAllowedInTestRuntime,
  tryGetStreamhubRuntimeEnv
} from "../../config/streamhubRuntimeEnv";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";
import {
  EfiConfigReadiness,
  evaluateEfiConfigReadiness,
  findEfiHomologationForConfig,
  findEfiPixValidationForConfig,
  loadEfiConfigForRuntimeSlot
} from "./efiCredentialResolver";
import { computeEfiConfigFingerprint } from "./efiConfigFingerprint";
import {
  EFI_RELEASED_RUNTIMES,
  isEfiFeatureReleased,
  getEfiFinancialCredentialsSource,
  isEfiPixChargeV2Active,
  isEfiPixReconciliationSweepActive,
  isEfiWebhookPipelineAsyncActive
} from "./efiFinancialSource";

const AUTH_TIMEOUT_MS = 15_000;

function envConfigured(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

/** Resolve caminho do P12 sem expor ao cliente. */
function resolvePixCertAbsolutePath(): string {
  const certName = (process.env.GERENCIANET_PIX_CERT || "").trim();
  // Espelha backend/src/config/Gn.ts → backend/certs/{nome}.p12
  return path.join(__dirname, `../../../certs/${certName}.p12`);
}

function pixCertFileFound(): boolean {
  const certName = (process.env.GERENCIANET_PIX_CERT || "").trim();
  if (!certName) return false;
  try {
    return fs.existsSync(resolvePixCertAbsolutePath());
  } catch {
    return false;
  }
}

function cobrancasBaseUrl(): string {
  return saasBillingFlags.gerencianetSandbox()
    ? "https://cobrancas-h.api.efipay.com.br"
    : "https://cobrancas.api.efipay.com.br";
}

export type EfiIntegrationStatusDto = {
  environment: "sandbox" | "production";
  credentials: {
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
    cobrancasClientIdConfigured: boolean;
    cobrancasClientSecretConfigured: boolean;
    pixKeyConfigured: boolean;
    webhookSecretConfigured: boolean;
    backendUrlConfigured: boolean;
  };
  certificate: {
    nameConfigured: boolean;
    fileFound: boolean;
  };
  flags: {
    pixEnabled: boolean;
    boletoEnabled: boolean;
    cardEnabled: boolean;
    cobrancasSettleEnabled: boolean;
    nativeSubscriptionEnabled: boolean;
    autoInvoiceEnabled: boolean;
    autoRenewOnPayment: boolean;
  };
  readiness: {
    pix: { ready: boolean; missing: string[] };
    cobrancas: { ready: boolean; missing: string[] };
  };
  authTests: {
    pixIsolatedAuthAvailable: boolean;
    pixIsolatedAuthNote: string;
    cobrancasOAuthAvailable: boolean;
  };
  /** Valor efetivo dos controles de ativação (RF0.2). */
  controls: EfiActivationControls;
  /** Cobrança Pix v2 (B3.2): controle de ambiente × liberação de código. */
  /** `released` = liberada no código para o runtime atual; `releasedRuntimes` = lista do código. */
  pixChargeV2: { configured: boolean; released: boolean; releasedRuntimes: string[]; active: boolean };
  /** Pipeline do webhook (B3.3): controle × liberação, pausa, varredura e métricas (RNF9). */
  webhookPipeline: {
    configured: string;
    released: boolean;
    releasedRuntimes: string[];
    active: boolean;
    workerPaused: boolean;
    sweep: { configured: boolean; released: boolean; releasedRuntimes: string[]; active: boolean };
    /** null = tabela indisponível (migration não aplicada ou banco fora). */
    stats: Record<string, unknown> | null;
  };
  /** Versão em execução (PT-9, P-B31-01); commit null = desconhecido (nunca inventado). */
  version: {
    currentCommit: string | null;
    source: AppBuildInfo["source"];
    dirty: boolean | null;
    builtAt: string | null;
  };
  /** Fonte ativa e prontidão da configuração do banco (RF1.6). Sem segredos. */
  credentialsSource: {
    /** Valor de `EFI_CREDENTIALS_SOURCE` (diagnóstico). */
    active: EfiActivationControls["credentialsSource"];
    /** Fonte usada por checkout, webhook e settle (P-B31-08). */
    financial: EfiActivationControls["credentialsSource"];
    /** `false` na B3.1: a fonte `database` não opera o financeiro real. */
    databaseFinancialReleased: boolean;
    databaseFinancialReleasedRuntimes: string[];
    database: EfiDatabaseSourceStatus;
  };
};

export type EfiDatabaseSourceStatus = {
  runtime: "test" | "production" | null;
  slot: "homologation" | "production" | null;
  efiEnvironment: "sandbox" | "production" | null;
  configFound: boolean;
  status: string | null;
  validConfig: boolean;
  missing: EfiConfigReadiness["missing"];
  configFingerprint: string | null;
  /** Validação Pix (mTLS) registrada para o fingerprint atual (P-B31-03). */
  pixValidation: { validated: boolean; at: string | null };
  homologation: {
    /** Só o slot `production` exige (D-P2). */
    required: boolean;
    homologated: boolean;
    at: string | null;
    commit: string | null;
    /** null quando não há homologação ou o commit atual/homologado é desconhecido. */
    versionDiffers: boolean | null;
  };
  /** A fonte `database` funcionaria agora neste runtime. */
  usable: boolean;
  blockedReason: string | null;
};

const EMPTY_DATABASE_STATUS: EfiDatabaseSourceStatus = {
  runtime: null,
  slot: null,
  efiEnvironment: null,
  configFound: false,
  status: null,
  validConfig: false,
  missing: [],
  configFingerprint: null,
  pixValidation: { validated: false, at: null },
  homologation: {
    required: false,
    homologated: false,
    at: null,
    commit: null,
    versionDiffers: null
  },
  usable: false,
  blockedReason: null
};

async function getDatabaseSourceStatus(): Promise<EfiDatabaseSourceStatus> {
  const empty = EMPTY_DATABASE_STATUS;
  let loaded: Awaited<ReturnType<typeof loadEfiConfigForRuntimeSlot>>;
  try {
    loaded = await loadEfiConfigForRuntimeSlot();
  } catch (err) {
    if (err instanceof AppError) {
      const runtime = tryGetStreamhubRuntimeEnv();
      return {
        ...empty,
        runtime,
        slot: runtime ? getAllowedEfiSlotForRuntime(runtime) : null,
        homologation: {
          ...empty.homologation,
          required: runtime === "production"
        },
        blockedReason: err.message
      };
    }
    throw err;
  }

  const { runtime, slot, row } = loaded;
  const configFingerprint = computeEfiConfigFingerprint(row);
  const pixValidation = await findEfiPixValidationForConfig(row, configFingerprint);
  const readiness = evaluateEfiConfigReadiness(row, {
    pixValidated: Boolean(pixValidation)
  });
  const homologation = await findEfiHomologationForConfig(
    row,
    configFingerprint
  );
  const required = slot === "production";
  const currentCommit = getAppBuildCommit();
  const versionDiffers =
    homologation && homologation.commit && currentCommit
      ? !isSameAppCommit(homologation.commit, currentCommit)
      : null;

  let blockedReason: string | null = null;
  if (!readiness.validConfig)
    blockedReason = `missing:${readiness.missing.join(",")}`;
  else if (required && !homologation)
    blockedReason = "ERR_EFI_INTEGRATION_NOT_HOMOLOGATED";

  return {
    runtime,
    slot,
    efiEnvironment: row.efiEnvironment,
    configFound: true,
    status: row.status,
    validConfig: readiness.validConfig,
    missing: readiness.missing,
    configFingerprint,
    pixValidation: {
      validated: Boolean(pixValidation),
      at: pixValidation?.at ?? null
    },
    homologation: {
      required,
      homologated: Boolean(homologation),
      at: homologation?.at ?? null,
      commit: homologation?.commit ?? null,
      versionDiffers
    },
    usable: blockedReason === null,
    blockedReason
  };
}

/** Linha única no boot com o valor efetivo dos controles (RF0.2, A4). Sem segredos. */
export function logEfiActivationControlsAtBoot(): void {
  const controls = getEfiActivationControls();
  const financialSource = getEfiFinancialCredentialsSource();
  const payload = {
    ...controls,
    financialCredentialsSource: financialSource,
    pixChargeV2Active: isEfiPixChargeV2Active(),
    webhookPipelineAsyncActive: isEfiWebhookPipelineAsyncActive(),
    pixReconciliationSweepActive: isEfiPixReconciliationSweepActive(),
    runtime: tryGetStreamhubRuntimeEnv(),
    // B34-T10: o ambiente do slot fica no banco (card de status); aqui só a autorização.
    testRuntimeProductionApiAllowed: isEfiProductionApiAllowedInTestRuntime(),
    currentCommit: getAppBuildCommit()
  };
  if (payload.testRuntimeProductionApiAllowed) {
    logger.warn(
      payload,
      payload.runtime === "test"
        ? "[efi] EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API=true: slot homologation pode usar a API Efí de PRODUÇÃO (dinheiro real) neste runtime test"
        : "[efi] EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API ignorada: vale só no runtime test"
    );
  }
  if (controls.pixChargeV2Enabled && !payload.pixChargeV2Active) {
    logger.warn(
      payload,
      "[efi] EFI_PIX_CHARGE_V2_ENABLED=true ainda não liberado no código: checkout segue o fluxo legado"
    );
  }
  if (controls.webhookPipeline === "async" && !payload.webhookPipelineAsyncActive) {
    logger.warn(
      payload,
      "[efi] EFI_WEBHOOK_PIPELINE=async ainda não liberado no código: webhook segue o fluxo legado"
    );
  }
  if (controls.pixReconciliationSweepEnabled && !payload.pixReconciliationSweepActive) {
    logger.warn(payload, "[efi] EFI_PIX_RECONCILIATION_SWEEP_ENABLED=true ainda não liberado no código");
  }
  if (controls.credentialsSource !== financialSource) {
    logger.warn(
      payload,
      "[efi] EFI_CREDENTIALS_SOURCE=database ainda não liberado para o financeiro: checkout, webhook e settle seguem em legacy_env"
    );
  }
  if (controls.invalid.length > 0) {
    logger.warn(
      payload,
      "[efi] controles de ativação com valor inválido (default aplicado)"
    );
  } else {
    logger.info(payload, "[efi] controles de ativação");
  }
}

/**
 * Status diagnóstico da integração Efí — sem secrets, tokens ou caminhos.
 */
export async function getEfiIntegrationStatus(): Promise<EfiIntegrationStatusDto> {
  const controls = getEfiActivationControls();
  const clientIdConfigured = envConfigured("GERENCIANET_CLIENT_ID");
  const clientSecretConfigured = envConfigured("GERENCIANET_CLIENT_SECRET");
  const cobrancasClientIdConfigured =
    envConfigured("EFI_COBRANCAS_CLIENT_ID") || clientIdConfigured;
  const cobrancasClientSecretConfigured =
    envConfigured("EFI_COBRANCAS_CLIENT_SECRET") || clientSecretConfigured;
  const pixKeyConfigured = envConfigured("GERENCIANET_PIX_KEY");
  const webhookSecretConfigured = envConfigured("WEBHOOK_SUBSCRIPTION_SECRET");
  const backendUrlConfigured = envConfigured("BACKEND_URL");
  const nameConfigured = envConfigured("GERENCIANET_PIX_CERT");
  const fileFound = pixCertFileFound();

  const pixMissing: string[] = [];
  if (!clientIdConfigured) pixMissing.push("GERENCIANET_CLIENT_ID");
  if (!clientSecretConfigured) pixMissing.push("GERENCIANET_CLIENT_SECRET");
  if (!nameConfigured) pixMissing.push("GERENCIANET_PIX_CERT");
  if (!fileFound) pixMissing.push("certificado_p12");
  if (!pixKeyConfigured) pixMissing.push("GERENCIANET_PIX_KEY");
  if (!backendUrlConfigured) pixMissing.push("BACKEND_URL");

  const cobrancasMissing: string[] = [];
  if (!cobrancasClientIdConfigured) {
    cobrancasMissing.push("EFI_COBRANCAS_CLIENT_ID|GERENCIANET_CLIENT_ID");
  }
  if (!cobrancasClientSecretConfigured) {
    cobrancasMissing.push("EFI_COBRANCAS_CLIENT_SECRET|GERENCIANET_CLIENT_SECRET");
  }

  return {
    environment: saasBillingFlags.gerencianetSandbox() ? "sandbox" : "production",
    credentials: {
      clientIdConfigured,
      clientSecretConfigured,
      cobrancasClientIdConfigured,
      cobrancasClientSecretConfigured,
      pixKeyConfigured,
      webhookSecretConfigured,
      backendUrlConfigured
    },
    certificate: {
      nameConfigured,
      fileFound
    },
    flags: {
      pixEnabled: saasBillingFlags.pixEnabled(),
      boletoEnabled: saasBillingFlags.boletoEnabled(),
      cardEnabled: saasBillingFlags.cardEnabled(),
      cobrancasSettleEnabled: saasBillingFlags.cobrancasSettleEnabled(),
      nativeSubscriptionEnabled: saasBillingFlags.nativeSubscriptionEnabled(),
      autoInvoiceEnabled: saasBillingFlags.autoInvoice(),
      autoRenewOnPayment: saasBillingFlags.autoRenewOnPayment()
    },
    readiness: {
      pix: { ready: pixMissing.length === 0, missing: pixMissing },
      cobrancas: {
        ready: cobrancasMissing.length === 0,
        missing: cobrancasMissing
      }
    },
    authTests: {
      pixIsolatedAuthAvailable: false,
      pixIsolatedAuthNote:
        "Legado (env): o SDK Pix não expõe autenticação isolada; o P12 é verificado por presença. " +
        "Configuração do banco: o teste de conexão do Super Admin valida o P12 e o OAuth Pix com mTLS.",
      cobrancasOAuthAvailable: true
    },
    controls,
    pixChargeV2: {
      configured: controls.pixChargeV2Enabled,
      released: isEfiFeatureReleased("pixChargeV2"),
      releasedRuntimes: [...EFI_RELEASED_RUNTIMES.pixChargeV2],
      active: isEfiPixChargeV2Active()
    },
    webhookPipeline: {
      configured: controls.webhookPipeline,
      released: isEfiFeatureReleased("webhookPipeline"),
      releasedRuntimes: [...EFI_RELEASED_RUNTIMES.webhookPipeline],
      active: isEfiWebhookPipelineAsyncActive(),
      workerPaused: controls.webhookWorkerPaused,
      sweep: {
        configured: controls.pixReconciliationSweepEnabled,
        released: isEfiFeatureReleased("pixReconciliationSweep"),
        releasedRuntimes: [...EFI_RELEASED_RUNTIMES.pixReconciliationSweep],
        active: isEfiPixReconciliationSweepActive()
      },
      stats: await import("./gatewayWebhookPipeline")
        .then(m => m.getGatewayWebhookPipelineStats())
        .then(s => s as unknown as Record<string, unknown>)
        .catch(() => null)
    },
    version: (({ commit, source, dirty, builtAt }) => ({
      currentCommit: commit,
      source,
      dirty,
      builtAt
    }))(getAppBuildInfo()),
    credentialsSource: {
      active: controls.credentialsSource,
      financial: getEfiFinancialCredentialsSource(),
      databaseFinancialReleased: isEfiFeatureReleased("databaseFinancial"),
      databaseFinancialReleasedRuntimes: [...EFI_RELEASED_RUNTIMES.databaseFinancial],
      database: await getDatabaseSourceStatus().catch(err => {
        logger.warn(
          { err: redactEfiSensitiveText((err as Error)?.message) },
          "[efi] status da fonte database indisponível"
        );
        return {
          ...EMPTY_DATABASE_STATUS,
          blockedReason: "ERR_EFI_STATUS_DB_UNAVAILABLE"
        };
      })
    }
  };
}

/** Remove vestígios de secrets de mensagens de erro. */
export function sanitizeEfiAuthErrorMessage(err: unknown): string {
  const anyErr = err as {
    response?: { data?: { error_description?: string; message?: string; error?: string } };
    message?: string;
    code?: string;
  };
  const raw =
    anyErr?.response?.data?.error_description ||
    anyErr?.response?.data?.message ||
    anyErr?.response?.data?.error ||
    anyErr?.message ||
    "Falha na autenticação Efí";

  const msg = redactEfiSensitiveText(raw);
  if (anyErr?.code === "ECONNABORTED" || /timeout/i.test(msg)) {
    return "Timeout ao autenticar na API Cobranças Efí";
  }
  return msg;
}

/** Remove tokens, client_secret e PEM de um texto livre (máx. 240 caracteres). */
export function redactEfiSensitiveText(raw: unknown): string {
  let msg = String(raw ?? "").slice(0, 240);
  msg = msg.replace(/(Bearer|Basic)\s+\S+/gi, "$1 ***");
  msg = msg.replace(/client_secret[=:]\s*\S+/gi, "client_secret=***");
  msg = msg.replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/gi, "[cert omitido]");
  return msg;
}

export type EfiCobrancasAuthTestResult = {
  ok: boolean;
  message: string;
  durationMs: number;
};

/**
 * OAuth client_credentials na API Cobranças.
 * Não cria cobranças; não persiste nem retorna o access_token.
 */
export async function testEfiCobrancasAuthentication(): Promise<EfiCobrancasAuthTestResult> {
  const started = Date.now();
  const clientId =
    process.env.EFI_COBRANCAS_CLIENT_ID || process.env.GERENCIANET_CLIENT_ID;
  const clientSecret =
    process.env.EFI_COBRANCAS_CLIENT_SECRET || process.env.GERENCIANET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      message: "Credenciais Cobranças ausentes (Client ID/Secret)",
      durationMs: Date.now() - started
    };
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const { data, status } = await axios.post(
      `${cobrancasBaseUrl()}/v1/authorize`,
      { grant_type: "client_credentials" },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        timeout: AUTH_TIMEOUT_MS,
        validateStatus: () => true
      }
    );

    const durationMs = Date.now() - started;
    const hasToken =
      data &&
      typeof data === "object" &&
      typeof (data as { access_token?: unknown }).access_token === "string" &&
      String((data as { access_token: string }).access_token).length > 0;

    if (status >= 200 && status < 300 && hasToken) {
      logger.info(
        { durationMs, environment: saasBillingFlags.gerencianetSandbox() ? "sandbox" : "production" },
        "[efiIntegration] cobrancas_oauth_ok"
      );
      return {
        ok: true,
        message: "Autenticação OAuth Cobranças bem-sucedida",
        durationMs
      };
    }

    const sanitized = sanitizeEfiAuthErrorMessage({
      response: { data },
      message: `HTTP ${status}`
    });
    logger.warn(
      { durationMs, status },
      "[efiIntegration] cobrancas_oauth_failed"
    );
    return {
      ok: false,
      message: sanitized,
      durationMs
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = sanitizeEfiAuthErrorMessage(err);
    logger.warn({ durationMs }, "[efiIntegration] cobrancas_oauth_error");
    return { ok: false, message, durationMs };
  }
}

/** Rate limit em memória para o endpoint de teste (por usuário). */
const testHits = new Map<number, number[]>();
const TEST_WINDOW_MS = 60_000;
const TEST_MAX_PER_WINDOW = 5;

export function assertEfiAuthTestRateLimit(userId: number): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const recent = (testHits.get(userId) || []).filter(t => now - t < TEST_WINDOW_MS);
  if (recent.length >= TEST_MAX_PER_WINDOW) {
    const oldest = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + TEST_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  recent.push(now);
  testHits.set(userId, recent);
  return { allowed: true };
}

/** Apenas para testes unitários. */
export function __resetEfiAuthTestRateLimitForTests(): void {
  testHits.clear();
}
