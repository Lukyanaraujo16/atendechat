import fs from "fs";
import path from "path";
import axios from "axios";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import { logger } from "../../utils/logger";

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
};

/**
 * Status diagnóstico da integração Efí — sem secrets, tokens ou caminhos.
 */
export function getEfiIntegrationStatus(): EfiIntegrationStatusDto {
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
        "O SDK Pix (gn-api-sdk-typescript) não expõe autenticação isolada sem chamada de API. " +
        "Não simulamos sucesso. Valide Client ID/Secret via OAuth Cobranças; " +
        "o P12 é verificado apenas por presença no status.",
      cobrancasOAuthAvailable: true
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

  let msg = String(raw).slice(0, 240);
  msg = msg.replace(/Bearer\s+\S+/gi, "Bearer ***");
  msg = msg.replace(/client_secret[=:]\s*\S+/gi, "client_secret=***");
  msg = msg.replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/gi, "[cert omitido]");
  if (anyErr?.code === "ECONNABORTED" || /timeout/i.test(msg)) {
    return "Timeout ao autenticar na API Cobranças Efí";
  }
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
